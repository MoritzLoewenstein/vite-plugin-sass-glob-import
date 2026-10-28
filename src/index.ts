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
import type { PluginOptions } from "./types.ts";

export default function sassGlobImports(_options: PluginOptions = {}): Plugin {
	const importRegex =
		/^([ \t]*(?:\/\*.*)?)@(use)\s+["']([^"']+\*[^"']*(?:\.scss|\.sass)?)["'];?([ \t]*(?:\/[/*].*)?)$/m;
	const options = { ..._options };
	const globToModuleIds = new Map<string, Set<string>>();
	let projectRoot = "";
	let server: ViteDevServer | undefined;

	function transform(src: string, id: string): string {
		let code = src;
		const filePath = path.dirname(id.replace(/\?.*$/, ""));
		const isSass =
			path.extname(id.replace(/\?.*$/, "")).toLowerCase() === ".sass";
		const ignorePaths = options.ignorePaths ?? [];
		let result = code.match(importRegex);

		while (result) {
			const [importRule, startComment, importType, globPattern, endComment] =
				result;
			if (!globPattern) {
				break;
			}

			if (options.autoInvalidation && server?.watcher) {
				const projectGlob = path.relative(
					projectRoot,
					path.resolve(filePath, globPattern),
				);
				const hasGlob = globToModuleIds.has(projectGlob);
				if (!globToModuleIds.get(projectGlob)?.has(id)) {
					const modSet = globToModuleIds.get(projectGlob) ?? new Set();
					modSet.add(id);
					globToModuleIds.set(projectGlob, modSet);
					if (!hasGlob) {
						const globDir = projectGlob.split("*")[0];
						if (globDir) {
							server.watcher.add(globDir);
						}
					}
				}
			}

			const files = globSync(globPattern, {
				absolute: true,
				cwd: filePath,
				nodir: true,
				windowsPathsNoEscape: true,
			}).sort((a, b) => a.localeCompare(b, "en"));

			const globPatternWithoutWildcard = globPattern.split("*")[0];
			if (
				globPatternWithoutWildcard &&
				!fs.existsSync(path.join(filePath, globPatternWithoutWildcard))
			) {
				console.warn(
					c.yellow(
						`Sass Glob Import: Directories don't exist for the glob pattern "${globPattern}"`,
					),
				);
			}

			const isGlobTrailStatic = !globPattern.split("/").at(-1)?.includes("*");
			const imports: string[] = [];
			files.forEach((anyFilename, index) => {
				if (!isSassOrScss(anyFilename)) {
					return;
				}

				const scssFilename = path
					.relative(filePath, anyFilename)
					.replace(/\\/g, "/")
					.replace(/^\//, "");
				const rootRelFilename = path.relative(projectRoot, anyFilename);
				if (
					!ignorePaths.some((ignorePath) =>
						minimatch(rootRelFilename, ignorePath),
					)
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

			code = code.replace(importRule, imports.join("\n"));

			result = code.match(importRegex);
		}

		return code;
	}

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
			const devServer = _server;
			server = devServer;
			devServer.watcher.on("all", async (_event, pathName) => {
				if (!/\.(?:sass|scss)$/i.test(path.extname(pathName))) {
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
					const modules = devServer.moduleGraph.getModulesByFile(mod);
					if (!modules) continue;
					for (const m of modules) {
						modsByFile.add(m);
					}
				}

				invalidateModules(devServer, modsByFile, Date.now());
				await Promise.all(
					Array.from(modsByFile).map((mod) => devServer.reloadModule(mod)),
				);
			});
		},
		transform: {
			filter: { id: /\.(?:sass|scss)(?:\?.*)?$/i },
			handler(src, id) {
				if (!/\.(?:sass|scss)(?:\?.*)?$/i.test(id)) {
					return null;
				}

				const code = transform(src, id);
				return code === src ? null : { code, map: null };
			},
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

function isSassOrScss(filename: string): boolean {
	return /\.(?:sass|scss)$/i.test(path.extname(filename));
}
