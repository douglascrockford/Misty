// scope.js
// 2026-09-24

// A. Make the 'scope' record.
// B. Upgrade 'name' nodes with 'function_nr', 'level', 'make'
// C. Report errors: undeclared, redeclared, unbalanced.

import format from "./format.js";

function empty() {
    return Object.create(null);
}

// Error reporting

const error_message = {
    already: "{term_a} was already declared.",
    undeclared: "{term_a} was not declared.",
    used_before: "{term_a} was used before it was declared.",
    unbalanced: "{term_a} was not properly balanced in an 'if'."
};

const error_preamble = "[{from_row}.{from_column}] ";

function error(message, the_token) {
    if (the_token.error === undefined) {
        the_token.error = message;
        errors.push(format(
            error_message[message],
            {term_a: the_token.text}
        ));
    }
}

const functino = empty();
[
    "'='", "'<>'", "'<'", "'>'", "'<='", "'>='", "'+'", "'-'", "'*'",
    "'/'", "'//'", "'/\\'", "'\\/'"
].forEach(function (name) {
    functino[name] = true;
});

const intrinsic = empty();
[
    "e", "false", "null", "pi", "true",
    "actor?", "array?", "blob?", "character?", "data?", "false?",
    "fit?", "function?", "integer?", "letter?", "logical?", "lower?",
    "null?", "number?", "pattern?", "record?", "stone?", "text?",
    "true?", "upper?", "whitespace?",
    "abs", "and", "apply", "arccos", "arcsin", "arctan", "arc_cosine",
    "arc_sine", "arc_tangent", "ceiling", "character", "codepoint",
    "cos", "cosine", "extract", "fallback", "filter", "find", "floor",
    "for", "format", "fraction", "left", "length", "log", "log_ten",
    "log_two", "lower", "mask", "max", "min", "modulo", "neg",
    "normalize", "not", "ones", "or", "parallel", "power", "race",
    "reduce", "remainder", "repeat", "replace", "reverse", "right",
    "right_signed", "rotate", "root", "round", "search", "sequence",
    "sin", "sine", "sign", "sort", "sqrt", "stone", "tan", "tangent",
    "trim", "turkish_lower", "turkish_upper", "upper", "whole", "xor",
    "zeros"
].forEach(function (name) {
    intrinsic[name] = true;
});

let errors;
let function_nr;
let functions;
let if_scope;
let scope;
let scopes;

function declare(node, make) {

// Declare the node in the current scope. Assure that it has not already been used.

    let if_now;
    let if_fork;

    node.make = make;
    node.level = 0;
    node.function_nr = function_nr;
    if (scope[node.text] !== undefined) {
        error("already", node);
    } else {
        if_now = if_scope[if_scope.length - 1];
        if (if_now === undefined) {
            scope[node.text] =  node;
        } else {
            if_fork = (
                if_now.phase
                ? if_now.then
                : if_now.else
            );
            if (if_fork[node.text] !== undefined) {
                error("already", node);
            } else {
                if_fork[node.text] = node;
                if (if_now.phase === false) {
                    if (
                        if_now.then[node.text] === undefined ||
                        if_now.then[node.text].make !== make
                    ) {
                        if_now.then[node.text] = node;
                        error("unbalanced", node);
                    }
                }
            }
        }
    }
}

function utilize(node) {

// Have we seen this name before? If so, teach the node about its heritage.

    let declaration = scope[node.text];
    if (declaration !== undefined) {
        node.make = declaration.make;
        node.function_nr = declaration.function_nr;
        node.level = declaration.level;
        return;
    }

// Search the outer scope chain.
// Perhaps this name was declared in an outer function.

    let outer_function_nr = function_nr;
    let level = 0;
    (function lookup() {
        if (outer_function_nr === 0) {
            return;
        }
        outer_function_nr = functions[outer_function_nr].outer;
        level = level + 1;
        declaration = scopes[outer_function_nr][node.text];
        if (declaration === undefined) {
            return lookup();
        }
    }());
    if (declaration !== undefined) {
        node.make = declaration.make;
        node.function_nr = outer_function_nr;
        node.level = level;
        scope[node.text] = node;
        declaration.closure = true;
        if (typeof declaration.after === "number" && declaration.after > node.at) {
            error("used_before", node);
        }
        return;
    }

// It might be intrinsic.

    if (intrinsic[node.text]) {
        node.make = "intrinsic";
        scope[node.text] = node;
        return;
    }

// Or it might be an undeclared variable.

    return error("undeclared", node);
}

function expression(node) {
    if (node === undefined) {
        return;
    }
    if (Array.isArray(node)) {
        return node.forEach(expression);
    }
    if (node.kind === "name") {
        return utilize(node);
    }
    if (node.kind === "infix") {
        return expression(node.operands);
    }
    if (node.kind === "operator") {
        return crunch(node);
    }
}

function crunch(node) {
    expression(node.first);
    expression(node.second);
    return expression(node.third);
}

function crunch_if(node) {

// Process the condition expressions.

    expression(node.first);
    if (Array.isArray(node.else_if)) {
        node.else_if.forEach(function (node) {
            return expression(node.first);
        });
    }

// Push a record onto the function's if scope. This will accumulate the
// variables declared in the consequences of the if.

    const local = {
        phase: true,
        then: {},
        else: {}
    };

    if_scope.push(local);

// Process the 'then' instructions.

    crunch_statements(node.statements);

// Change the phase to false and process the else instructions.

    local.phase = false;
    crunch_statements(node.else);

// Verify that the declarations in 'then' and 'else' match.

    function verify_branch() {
        Object.keys(local.then).forEach(function (name) {
            if (local.then[name].make !== local.else?.[name]?.make) {
                error("unbalanced", local.then[name]);
            }
        });
    }

    verify_branch();

// Then for each else_if, clear the 'else' and process the branch, and verify.

    if (node.else_if !== undefined) {
        node.else_if.forEach(function (part) {
            local.else = {};
            crunch_statements(part.statements);
            verify_branch();
        });
    }

// Remove the object from the if_scope.

    let waste = if_scope.pop();

// If if_scope is now empty, copy the names from the 'then' to the scope.
// Otherwise, copy the names from the 'then' to the record at the current
// end of the if_scope.

    const remote = if_scope[if_scope.length - 1];
    const taker = (
        if_scope.length === 0
        ? scope
        : (
            remote.phase
            ? remote.then
            : remote.else
        )
    );
    local.then.forEach(function (node) {
        scope[node.name]  = node;
    });
};

const statement = {
    assign: crunch,
    call: crunch,
    def(node) {
        expression(node.second);
        declare(node.first, "def");
    },
    if: crunch_if,
    jump: crunch,
    return: crunch,
    send: crunch,
    var(node) {
        expression(node.second);
        declare(node.first, "var");
    }
};

function crunch_statements(list) {
    if (list !== undefined) {
        list.forEach(function (node) {
            statement[node.text](node);
        });
    }
}

export default Object.freeze(function scope_phase(tree) {
    if (Array.isArray(tree)) {
        return tree;
    }
    errors = [];
    scopes = [];
    tree.scopes = scopes;
    functions = tree.functions;
    functions.forEach(function (a_function, a_function_nr) {
        function_nr = a_function_nr
        scope = empty();
        if_scope = [];
        scopes.push(scope);
        if (a_function.name !== undefined) {
            declare(a_function.name, "function");
        }
        a_function.parameters.forEach(function (parameter) {
            declare(parameter, "parameter");
            return expression(parameter.first);    // default expression
        });
        crunch_statements(a_function.statements);
    });
    return (
        errors.length > 0
        ? errors
        : tree
    );
});
