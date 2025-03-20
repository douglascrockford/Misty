// slot.js # Misty Mcode Generator
// 2025-03-19

// Slot takes a parse tree and assigns slots to the variables in the scopes.
// It takes three passes thru each scope:
//      slot the inputs and the outer variables this function closes over
//      slot the closure variables that are not inputs
//      slot the local variables

export default Object.freeze(function slot(tree) {
    if (Array.isArray(tree)) {
        return tree;
    }
    tree.scopes.forEach(function (scope, function_nr) {
        const names = Object.keys(scope);
        var slot_nr = 0;

        names.forEach(function (name) {
            const variable = scope[name];
            if (variable.level === 0) {
                if (variable.make === "input") {
                    variable.slot = variable.input_nr;
                    if (slot_nr <= variable.slot) {
                        slot_nr = variable.slot + 1;
                    }
                }
            } else if (typeof variable.level === "number") {
                variable.slot = tree.scopes[variable.function_nr][name].slot
            }
        });
        names.forEach(function (name) {
            const variable = scope[name];
            if (
                variable.level === 0 &&
                variable.closure === true &&
                (
                    variable.make === "var" ||
                    variable.make === "def" ||
                    variable.make === "use"
                )
            ) {
                variable.slot = slot_nr;
                slot_nr = slot_nr + 1;
            }
        });
        tree.functions[function_nr].nr_close_slots = slot_nr;
        names.forEach(function (name) {
            const variable = scope[name];
            if (
                variable.level === 0 &&
                !variable.closure &&
                (
                    variable.make === "var" ||
                    variable.make === "def" ||
                    variable.make === "use"
                )
            ) {
                variable.slot = slot_nr;
                slot_nr = slot_nr + 1;
            }
        });
        tree.functions[function_nr].nr_slots = slot_nr;
    });
    return tree;
});
