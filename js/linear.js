// linear.js # Misty Mcode Generator
// 2025/03/29

// linear takes a parse tree and produces an mcode object.

export default Object.freeze(function mgen(tree) {
    var next_slot;
    var last_slot = tree.nr_slots;
    var gen_statement;

    function gen(node, reg) {
        if (node /*is a local register*/) {
            if (reg !== undefined && node.register) {
                emit("move", reg, node.register);
            }
            return reg;
        }
        var dest = reg;
        if (dest === undefined) {
            dest = next_slot;
            next_slot = next_slot + 1;
            if (next_slot > last_slot) {
                last_slot = next_slot;
            }
        }
        operator[node.kind](node, dest);
        return dest;
    }

    function gen_branch(label, expression) {

    }

    function gen_and(node) {

    }

    function gen_statements(list) {
        list.forEach(function (statement) {
            var reset_slot = next_slot;
            gen_statement[statement.name](statement);
            next_slot = reset_slot;
        });
    }

    gen_statement = {
        assign: function (statement) {

        },
        if: function (statement) {
            then_label = make_label();
            else_label = make_label();
            fi_label = make_label();
            gen_conditional_jump(statement, then_label, else_label), ;
            gen_label(then_label);
            gen_statements(statement.statements);
            gen_jump(fi_label)
            gen_label(then_label);
            if (statement.else) {
                gen_statements(statement.else);
            }
            gen_label(fi_label);
        }
    };

    function gen_functions(list) {
        list.forEach(function (func) {

        });
    }

    gen_functions(tree.functions);

    return (
        errors.length > 0
        ? errors
        : main
    );
});
