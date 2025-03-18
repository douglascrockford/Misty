//prep.js
// 2025-03-08

// prep takes mst/source.mst and produces a tree in mtree/source.json

//  misty/node> node prep source

const mst_directory = "../mst/";
const mst_extension = ".mst";
const mtree_directory = "../mtree/";
const mtree_extension = ".json";

import {
    readFileSync as read,
    writeFileSync as write,
    unlinkSync as erase
} from "fs";
import tokenize from "../js/tokenize.js";
import parse from "../js/parse.js";

let name = process.argv[2];
if (name.endsWith(mst_extension)) {
    name = name.slice(0, name.length - mst_extension.length);
}
if (name === "") {
    console.log("Missing filename.");
    process.exit(1);
}
let source = "";
try {
    source = read(mst_directory + name + mst_extension, "utf8");
} catch (e) {
    source = "";
}
if (source.length < 10) {
    console.log("Missing '" + mst_directory + name + mst_extension + "'.");
    process.exit(1);
}
try {
    erase(mtree_directory + name + mtree_extension);
} catch (e) {
}
const tree = parse(tokenize(source));
if (Array.isArray(tree)) {
    console.log(JSON.stringify(
        tree,
        null,
        4
    ));
    process.exit(1);
}

if (name.indexOf(tree.name) < 0) {
    console.log(name + " <> " + tree.name);
    process.exit(1);
}

let result = JSON.stringify(
    tree,
    null,
    4
);

write(
    mtree_directory + name + mtree_extension,
    result,
    "utf8"
);
console.log("Done. " + result.length)
