// scope.js
// 2026-10-06

// The scope module takes a parse tree, an endowment record, and a log access
// record. It fills out the scope array, which it uses to annotate the
// variables with make, function_nr, and level. It also incorporates the
// endowments into the tree, and specify access in the log statements.

// Errors are reported.

import format from "./format.js";

function empty() {
    return Object.create(null);
}

// Error reporting

const error_message = {
    already: "'{term_a}' was already declared.",
    jump: "'jump' may not be used in a function that has inner functions.",
    forbidden: "'{term_a}' is forbidden.",
    not_var: "'{term_a}' is not a 'var'.",
    paren: "The subexpression with '{term_a}' must be parenthesized.",
    unbalanced: "'{term_a}' was not properly balanced in an 'if'.",
    undeclared: "'{term_a}' was not declared.",
    used_before: "'{term_a}' was used before it was declared."
};

const error_preamble = "[{from_row}.{from_column}] ";

function error(message, the_token) {
    errors.push(format(
        error_preamble + error_message[message],
        {
            from_column: the_token.from_column,
            from_row: the_token.from_row,
            term_a: the_token.text
        }
    ));
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
let grant;
let if_scope;
let intrinsic_used;
let log_access;

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
        error(
            (
                scope[node.text].level === 0
                ? "already"
                : "used_before"
            ),
            node
        );
        scope[node.text] =  node;
    } else {
        if_now = if_scope[if_scope.length - 1];
        if (if_now === undefined) {
            scope[node.text] =  node;
        } else {
            node.if = true;
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
    let value;
    if (node.make === "endowment") {
        value = grant[node.text];
        if (typeof value === "number") {
            node.kind = "number";
            node.number = value;
            node.text = String(value);
        } else if (typeof value === "string") {
            node.kind = "text";
            node.number = value;
            node.text = value;
        } else if (typeof value === "boolean") {
            node.kind = "name";
            node.make = "intrinsic";
            node.text = String(value);
        } else {
            node.kind = "endowment";
            node.endowment = value;
        }
        return;
    }

// Have we seen this name before? If so, teach the node about its heritage.

    let declaration = scope[node.text];
    if (declaration !== undefined) {
        if (declaration.make === undefined) {
            return error("undeclared", node);
        }
        node.make = declaration.make;
        node.function_nr = declaration.function_nr;
        node.level = declaration.level;
        if (
            typeof declaration.after === "number" &&
            declaration.after > node.at
        ) {
            error("used_before", node);
        }
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
        if (
            typeof declaration.after === "number" &&
            declaration.after > node.at
        ) {
            error("used_before", node);
        }
        return;
    }

// It might be intrinsic.

    if (intrinsic[node.text]) {
        node.make = "intrinsic";
        scope[node.text] = node;
        intrinsic_used[node.text] = true;
        return;
    }

// Or it might be an undeclared variable.

    scope[node.text] = node;
    return error("undeclared", node);
}

function same_operators(array, at = 1) {
    if (at >= array.length) {
        return;
    }
    if (array[at - 1].text !== array[at].text) {
        return error("paren", array[at]);
    }
    return same_operators(array, at + 1);
}

function crunch_expression(node) {
    if (node === undefined) {
        return;
    }
    if (Array.isArray(node)) {
        return node.forEach(crunch_expression);
    }
    if (node.kind === "name") {
        return utilize(node);
    }
    if (node.kind === "infix") {
        if (node.precedence === 0 || node.precedence === 4) {
            same_operators(node.operators);
        }
        return crunch_expression(node.operands);
    }
    if (node.kind === "operator") {
        return crunch(node);
    }
}

function crunch(node) {
    crunch_expression(node.first);
    crunch_expression(node.second);
    return crunch_expression(node.third);
}

function verify_branch(local) {
    Object.keys(local.then).forEach(function (name) {
        if (local.then[name].make !== local.else?.[name]?.make) {
            error("unbalanced", local.else[name] ?? local.then[name]);
        }
    });
}

function crunch_if(node) {

// Process the condition expressions.

    crunch_expression(node.first);
    if (Array.isArray(node.else_if)) {
        node.else_if.forEach(function (node) {
            return crunch_expression(node.first);
        });
    }

// Push a record onto the function's if scope. This will accumulate the
// variables declared in the consequences of the if.

    const local = {
        phase: true,
        then: empty(),
        else: empty()
    };

    if_scope.push(local);

// Process the 'then' instructions.

    crunch_statements(node.statements);
    local.phase = false;

// For each 'else if', process the branch, and verify.

    if (node.else_if !== undefined) {
        node.else_if.forEach(function (part) {
            crunch_statements(part.statements);
            verify_branch(local);
            local.else = empty();
        });
    }

// Process the 'else' instructions.

    crunch_statements(node.else);
    verify_branch(local);

// Remove the object from the if_scope.

    let waste = if_scope.pop();

// If if_scope is now empty, copy the names from the 'then' to the scope.
// Otherwise, copy the names from the 'then' to the record at the current
// end of the if_scope.

    let remote;
    let taker = scope;
    const keys = Object.keys(local.then);
    if (keys.length > 0) {
        if (if_scope.length > 0) {
            remote = if_scope[if_scope.length - 1];
            taker = (
                remote.phase
                ? remote.then
                : remote.else
            );
        }
        keys.forEach(function (key) {
            taker[key]  = local.then[key];
        });
    }
};

const statement = {
    assign(node) {
        crunch(node);
        if (node.first.kind === "name" && node.first.text !== "var") {
            error("not_var", node.first);
        }
    },
    call: crunch,
    def(node) {
        declare(node.first, "def");
        crunch_expression(node.second);
    },
    if: crunch_if,
    jump(node) {
        if (functions[function_nr].nr_functions > 0) {
            error("jump", node);
        }
        crunch(node);
    },
    log(node) {
        node.status = log_access[node.first.text];
        if (node.status === "forbidden" || node.status === undefined) {
            error("forbidden", node.first);
        } else if (node.status === "ignored") {
            node.kind = undefined;
        }
        return crunch_expression(node.second);
    },
    return: crunch,
    send: crunch,
    var(node) {
        declare(node.first, "var");
        crunch_expression(node.second);
    }
};

function crunch_statements(list) {
    if (list !== undefined) {
        list.forEach(function (node) {
            statement[node.text](node);
        });
    }
}

export default Object.freeze(function scope_phase(tree, endow, log) {
    if (Array.isArray(tree)) {
        return tree;
    }
    grant = endow;
    log_access = log;
    errors = [];
    intrinsic_used = [];
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
            return crunch_expression(parameter.first);    // default expression
        });
        crunch_statements(a_function.statements);
    });
    tree.intrinsics = Object.keys(intrinsic_used);
    return (
        errors.length > 0
        ? errors
        : tree
    );
});
