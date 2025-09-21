import fs from "node:fs";
import path from "node:path";
import c from "ansi-colors";
import { globSync } from "glob";
import { minimatch } from "minimatch";
import type { Plugin } from "vite";
import type { PluginOptions, TransformResult } from "./types";

let IMPORT_REGEX: RegExp;
let options: PluginOptions;
export default function sassGlobImports(_options: PluginOptions = {}): Plugin {
	IMPORT_REGEX =
		/^([ \t]*(?:\/\*.*)?)@(import|use)\s+["']([^"']+\*[^"']*(?:\.scss|\.sass)?)["'];?([ \t]*(?:\/[/*].*)?)$/gm;
	options = _options;
	return {
		name: "sass-glob-import",
		enforce: "pre",
		transform(src: string, id: string): TransformResult {
			const fileName = path.basename(id);
			const filePath = path.dirname(id);
			return {
				code: transform(src, fileName, filePath),
				map: null, // provide source map if available
			};
		},
	};
}

function isSassOrScss(filename: string) {
	return (
		!fs.statSync(filename).isDirectory() &&
		path.extname(filename).match(/\.sass|\.scss/i)
	);
}

function transform(src: string, fileName: string, filePath: string): string {
	// Determine if this is Sass (vs SCSS) based on file extension
	const isSass = path.extname(fileName).match(/\.sass/i);

	// Store base locations
	const searchBases = [filePath];
	const ignorePaths = options.ignorePaths || [];
	const contentLinesCount = src.split("\n").length;

	for (let i = 0; i < contentLinesCount; i++) {
		const result = [...src.matchAll(IMPORT_REGEX)];
		if (result.length === 0) continue;

		const [importRule, startComment, importType, globPattern, endComment] =
			result[0];

		let files: string[] = [];
		let basePath = "";
		for (let i = 0; i < searchBases.length; i++) {
			basePath = searchBases[i];

			files = globSync(path.join(basePath, globPattern), {
				cwd: "./",
				windowsPathsNoEscape: true,
			}).sort((a, b) => a.localeCompare(b, "en"));

			// Do directories exist matching the glob pattern?
			const globPatternWithoutWildcard = globPattern.split("*")[0];
			if (globPatternWithoutWildcard.length) {
				const directoryExists = fs.existsSync(
					path.join(basePath, globPatternWithoutWildcard),
				);
				if (!directoryExists) {
					console.warn(
						c.yellow(
							`Sass Glob Import: Directories don't exist for the glob pattern "${globPattern}"`,
						),
					);
				}
			}

			if (files.length > 0) {
				break;
			}
		}

		const isGlobTrailStatic = !globPattern.split("/").at(-1)?.includes("*");
		const imports = [];
		files.forEach((anyFilename: string, index: number) => {
			if (!isSassOrScss(anyFilename)) {
				return;
			}

			const scssFilename = path
				// Remove parent base path
				.relative(basePath, anyFilename)
				.replace(/\\/g, "/")
				// Remove leading slash
				.replace(/^\//, "");
			if (
				!ignorePaths.some((ignorePath: string) => {
					return minimatch(scssFilename, ignorePath);
				})
			) {
				const file = isGlobTrailStatic
					? `"${scssFilename}" as ${path.parse(scssFilename).name}_${index}`
					: `"${scssFilename}"`;
				imports.push(`@${importType} ${file}${isSass ? "" : ";"}`);
			}
		});

		if (startComment) {
			imports.unshift(startComment);
		}

		if (endComment) {
			imports.push(endComment);
		}

		const replaceString = imports.join("\n");
		// biome-ignore lint: easier for now
		src = src.replace(importRule, replaceString);
	}

	// Return the transformed source
	return src;
}
