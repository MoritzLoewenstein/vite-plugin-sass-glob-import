export interface PluginOptions {
	ignorePaths?: string[];
	autoInvalidation?: boolean;
}

export interface TransformResult {
	code: string;
	map: null;
}
