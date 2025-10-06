export interface PluginOptions {
	/**
	 * ignore these files for all glob imports
	 * @example ['blocks/_default/block.scss']
	 */
	ignorePaths?: string[];
	/**
	 * enables autoHmr when editing a file which is imported via glob
	 * @default false
	 */
	autoInvalidation?: boolean;
}

export interface TransformResult {
	code: string;
	map: null;
}
