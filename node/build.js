//build.js
// 2025-03-18

// build takes mtree/program.json and makes mcode/program.mcode, using the
// requested modules.

//  misty/node> node build program

const mcode_directory = "../mcode/";
const mcode_extension = ".json";
const mtree_directory = "../mtree/";
const mtree_extension = ".json";

import {
    readFileSync as read,
    writeFileSync as write,
    unlinkSync as erase
} from "fs";
import linear from "../js/linear.js";

let name = process.argv[2];
if (name.endsWith(mtree_extension)) {
    name = name.slice(0, name.length - mtree_extension.length);
}
if (name === "") {
    console.log("Missing filename.");
    process.exit(1);
}
function read_tree(name, kind) {
    try {
        let tree_json = read(mtree_extension + name + mtree_extension, "utf8");
        let tree = JSON.parse(tree_json);
        if (tree.kind !== kind) {
            console.log("'" + name + "'is not a '" + kind + "'.");
            process.exit(1);
        }
        return tree;
    } catch (e) {
        console.log("Missing '" + mtree_extension + name + mtree_extension + "'.");
        process.exit(1);
    }
}
try {
    erase(mcode_directory + name + mcode_extension);
} catch (e) {
}
let usages = Object.create(null);
let trees = [];
let function_base = 0;
let function_bases = [];

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

let tree = read_tree(name, "program");
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
