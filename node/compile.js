//compile.js
// 2025-07-16

//  misty/node> node compile 'name'

// compile takes a program text from mst/name.mst. It parses and leaves a tree in
// mtree/name.json.
// It then parses the modules and makes mcode/name.mcode


const source_directory = "../mst/";
const source_extension = ".mst";
const mtree_directory = "../mtree/";
const mtree_extension = ".json";
const mcode_directory = "../mcode/";
const mcode_extension = ".json";

import tokenize from "../js/tokenize.js";
import parse from "../js/parse.js";
import slot from "../js/slot.js";
import gen from "../js/gen.js";
import {
    readFileSync as read,
    writeFileSync as write,
    unlinkSync as erase
} from "fs";
let usages = Object.create(null);
let trees = [];
let function_base = 0;
let function_bases = [];

let name = process.argv[2];
if (!name) {
    console.log("Missing filename.");
    process.exit(1);
}
function read_source(name) {
    let source = "";
    try {
        source = read(source_directory + name + source_extension, "utf8");
    } catch (e) {
        source = "";
    }
    if (source.length < 10) {
        console.log("Missing '" + source_directory + name + source_extension + "'.");
        process.exit(1);
    }
    return source;
}

function make_tree(name) {
    try {
        erase(mtree_directory + name + mtree_extension);
    } catch (e) {}
    var tree = tokenize(read_source(name));
    tree = parse(tree);
    tree = slot(tree);
    if (Array.isArray(tree)) {
        console.log(JSON.stringify(
            tree,
            null,
            4
        ));
        process.exit(1);
    }
    return tree;
}

try {
    erase(mcode_directory + name + mcode_extension);
} catch (e) {}

function usage(tree, name) {
    let slot = trees.length;
    trees.push(tree);
    function_bases.push(function_base);
    function_base = function_base + tree.functions.length;
    if (slot > 0) {
        usages[name] = slot;
    }
    if (Array.isArray(tree.uses)) {
        tree.uses.forEach(function (module) {
            let tree;
            if (usage[module] !== undefined) {
                tree = read_tree(module, "module");
                usage(tree, module);
            }
        });
    }
}

usage(tree, name);

// At this point, we have an array of parse trees, a function_base offset for
// each tree, and an object that associates module names with the tree slots.

// Next, we generate mcode from the trees.

// --------------------------------

write(
    mcode_directory + name + mcode_extension,
    result,
    "utf8"
);
console.log("Done. " + result.length)
