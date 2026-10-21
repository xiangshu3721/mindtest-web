/** 词表以职业六芒星页面为准。仓库里能读到原文件时用原文件；云函数包里没有仓库根目录时用 vendor 快照。 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("../../star/js/data.js", import.meta.url);
const bundledUrl = new URL("./vendor/star-data.js", import.meta.url);
const chosen = existsSync(fileURLToPath(sourceUrl)) ? sourceUrl : bundledUrl;
const data = await import(chosen);

export const GROUPS = data.GROUPS;
export const WORDS = data.WORDS;
export const CULL_FIRST = data.CULL_FIRST;
export const CULL_SECOND = data.CULL_SECOND;
export const CULL_THIRD = data.CULL_THIRD;
export const KEEP = data.KEEP;
export const REVIVE = data.REVIVE;
