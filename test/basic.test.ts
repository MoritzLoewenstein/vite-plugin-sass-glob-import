import { describe, expect, it, vi } from "vitest";
import sassGlobImportPlugin from "../src";

const source = `
body {}
@import "files/*.scss";
`;

describe("it correctly converts glob patterns to inline imports", () => {
	// biome-ignore lint: TODO
	const plugin: any = sassGlobImportPlugin();
	plugin.configResolved({ root: process.cwd() });

	it("for SCSS", () => {
		const expected = `
body {}
@import "files/_file-a.scss";
@import "files/_file-b.scss";
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});

	it("for Sass", () => {
		const expected = `
body {}
@import "files/_file-a.scss"
@import "files/_file-b.scss"
`;
		const path = `${__dirname}/virtual-file.sass`;
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});

	it("with @use", () => {
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
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});
});

describe("it warns for invalid glob paths", () => {
	// biome-ignore lint: TODO
	const plugin: any = sassGlobImportPlugin();
	plugin.configResolved({ root: process.cwd() });

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
		expect(plugin.transform(source, path)?.code).toEqual(expected);
		expect(console.warn).toHaveBeenCalledTimes(1);
	});
});

describe("it correctly converts glob patterns with static trail to namespace imports", () => {
	// biome-ignore lint: TODO
	const plugin: any = sassGlobImportPlugin();
	plugin.configResolved({ root: process.cwd() });

	it.todo("for SCSS", () => {
		//TODO does this even work?
		const expected = `
body {}
@import "files/a/foo.scss";
@import "files/b/foo.scss";
`;
		const path = `${__dirname}/virtual-file.scss`;
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});

	it.todo("for Sass", () => {
		//TODO does this even work?
		const expected = `
body {}
@import "files/a/foo.scss"
@import "files/b/foo.scss"
`;
		const path = `${__dirname}/virtual-file.sass`;
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});

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
		expect(plugin.transform(source, path)?.code).toEqual(expected);
	});
});
