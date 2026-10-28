import { describe, expect, it, vi } from "vitest";
import sassGlobImportPlugin from "../src/index.js";

function runTransform(
	plugin: ReturnType<typeof sassGlobImportPlugin>,
	source: string,
	id: string,
) {
	const transform = plugin.transform;
	if (!transform || typeof transform === "function") {
		throw new Error("Expected an object transform hook");
	}
	const handler = transform.handler as (
		this: unknown,
		code: string,
		id: string,
	) => { code: string; map: null } | null;
	return handler.call(undefined, source, id)?.code ?? null;
}

describe("it correctly converts glob patterns to inline @use", () => {
	const plugin = sassGlobImportPlugin();

	it("for SCSS", () => {
		const source = `
body {}
@use "files/*.scss";
`;
		const expected = `
body {}
@use "files/_file-a.scss";
@use "files/_file-b.scss";
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(runTransform(plugin, source, path)).toEqual(expected);
	});

	it("for Sass", () => {
		const source = `
body {}
@use "files/*.scss";
`;
		const expected = `
body {}
@use "files/_file-a.scss"
@use "files/_file-b.scss"
`;
		const path = `${__dirname}/virtual-file.sass`;
		expect(runTransform(plugin, source, path)).toEqual(expected);
	});

	it("ignores @import (deprecated)", () => {
		const source = `
body {}
@import "files/*.scss";
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(runTransform(plugin, source, path)).toBeNull();
	});

	it("skips non-Sass modules", () => {
		const source = '@use "files/*.scss";';
		const path = `${__dirname}/virtual-file.js`;
		expect(runTransform(plugin, source, path)).toBeNull();
	});

	it("converts multiple glob directives", () => {
		const source = `
@use "files/*.scss";
@use 'files/*.scss';
`;
		const expected = `
@use "files/_file-a.scss";
@use "files/_file-b.scss";
@use "files/_file-a.scss";
@use "files/_file-b.scss";
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(runTransform(plugin, source, path)).toEqual(expected);
	});
});

describe("it warns for invalid glob paths", () => {
	const plugin = sassGlobImportPlugin();

	it("for SCSS", () => {
		const source = `
body {}
@use "foo/**/*.scss";
`;
		const expected = `
body {}

`;
		const path = `${__dirname}/virtual-file.scss`;
		vi.spyOn(console, "warn");
		expect(runTransform(plugin, source, path)).toEqual(expected);
		expect(console.warn).toHaveBeenCalledTimes(1);
	});
});

describe("it correctly converts glob patterns with static trail to namespace imports", () => {
	const plugin = sassGlobImportPlugin();

	it("with @use", () => {
		const source = `
body {}
@use "files/*/foo.scss";
`;
		const expected = `
body {}
@use "files/a/foo.scss" as foo_0;
@use "files/b/foo.scss" as foo_1;
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(runTransform(plugin, source, path)).toEqual(expected);
	});
});
