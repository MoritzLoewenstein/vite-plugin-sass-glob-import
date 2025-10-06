import fs from "node:fs";
import path from "node:path";
import c from "ansi-colors";
import { globSync } from "glob";
import { minimatch } from "minimatch";
import {
	type ModuleNode,
	normalizePath,
	type Plugin,
	type ViteDevServer,
} from "vite";
import type { PluginOptions, TransformResult } from "./types";

let IMPORT_REGEX: RegExp;
let options: PluginOptions;
let globToModuleIds: Map<string, Set<string>>;
let projectRoot: string;
let server: ViteDevServer;
export default function sassGlobImports(_options: PluginOptions = {}): Plugin {
	IMPORT_REGEX =
		/^([ \t]*(?:\/\*.*)?)@(import|use)\s+["']([^"']+\*[^"']*(?:\.scss|\.sass)?)["'];?([ \t]*(?:\/[/*].*)?)$/gm;
	options = _options;
	globToModuleIds = new Map();
	return {
		name: "sass-glob-import",
		enforce: "pre",
		configResolved(config) {
			projectRoot = normalizePath(config.root);
			if (options.autoInvalidation && !config.server.watch) {
				config.logger.warn(
					"vite-plugin-sass-glob-import: set server.watch: true for automatic glob module invalidation",
				);
				options.autoInvalidation = false;
			}
		},
		configureServer(_server) {
			if (!options.autoInvalidation) {
				return;
			}
			server = _server;
			server.watcher.on("all", async (_event, pathName) => {
				if (!path.extname(pathName).match(/\.sass|\.scss/i)) {
					return;
				}

				const relPathName = path.relative(projectRoot, pathName);
				const modsToInvalidate = new Set<string>();
				for (const [glob, modSet] of globToModuleIds) {
					if (minimatch(relPathName, glob)) {
						for (const mod of modSet) {
							modsToInvalidate.add(mod);
						}
					}
				}

				const modsByFile = new Set<ModuleNode>();
				for (const mod of modsToInvalidate) {
					const modules = server.moduleGraph.getModulesByFile(mod);
					if (!modules) continue;
					for (const m of modules) {
						modsByFile.add(m);
					}
				}

				invalidateModules(server, modsByFile, Date.now());
				await Promise.all(
					Array.from(modsByFile).map((mod) => server.reloadModule(mod)),
				);
			});
		},
		transform(src: string, id: string): TransformResult {
			return {
				code: transform(src, id),
				map: null, // provide source map if available
			};
		},
	};
}

function invalidateModules(
	server: ViteDevServer,
	modules: Set<ModuleNode>,
	timestamp: number,
): Set<ModuleNode> {
	const seen = new Set<ModuleNode>();
	for (const mod of modules) {
		server.moduleGraph.invalidateModule(mod, seen, timestamp, true);
	}
	return modules;
}

function isSassOrScss(filename: string) {
	return (
		!fs.statSync(filename).isDirectory() &&
		path.extname(filename).match(/\.sass|\.scss/i)
	);
}

function transform(src: string, id: string): string {
	const fileName = path.basename(id);
	const filePath = path.dirname(id);
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

		if (options.autoInvalidation && server?.watcher) {
			const projectGlob = path.relative(
				projectRoot,
				path.resolve(path.join(filePath, globPattern)),
			);
			const hasGlob = globToModuleIds.has(projectGlob);
			if (!globToModuleIds.get(projectGlob)?.has(id)) {
				const modSet = globToModuleIds.get(projectGlob) ?? new Set();
				modSet.add(id);
				globToModuleIds.set(projectGlob, modSet);
				if (!hasGlob) {
					const globDir = projectGlob.split("*")[0];
					server.watcher.add(globDir);
				}
			}
		}

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
			const rootRelFilename = path.relative(projectRoot, anyFilename);
			if (
				!ignorePaths.some((ignorePath: string) => {
					return minimatch(rootRelFilename, ignorePath);
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
