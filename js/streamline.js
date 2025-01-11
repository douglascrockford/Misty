// streamline.js

var terminal_op = {
    jump: true,
    return: true,
    fail: true,
    tail: true
};

var antijump = {
    jf: 'jt',
    jt: 'jf',
    jeq0: 'jne0',
    jne0: 'jeq0',
    jlt0: 'jge0',
    jle0: 'jgt0',
    jgt0: 'jle0',
    jge0: 'jlt0',
    jo: 'jno',
    jno: 'jo',
    jv: 'jnv',
    jnv: 'jv'
};


function streamline(list) {
    var b;
    var i;
    var j = 0;
    var l = list.length;
    var label = {};
    var m;
    var t;
    var reached = [];

    function delete_inst(n) {
        for (var i = 0; i < list.length; i += 1) {
            if (list[i].yz && list[i].yz > n) {
                if (list[i].op.charAt(0) == 'j' || list[i].op == 'opx') {
                    list[i].yz -= 1;
                }
            }
        }
        list.splice(n, 1);
    }

    function reach(i) {
        while (!reached[i] && i < list.length) {
            reached[i] = true;
            var op = list[i].op, c = op.charAt(0);
            if (op == 'j') {
                i = list[i].yz;
            } else if (c == 'j') {
                reach(list[i].yz);
                i += 1;
            } else if (c == 'r' || c == 'x') {
                return;
            } else if (op == 'opx') {
                reach(list[i].yz);
                reached[i + 1] = true;
                i += 2;
            } else {
                i += 1;
            }
        }
    }

    function shorte() {
        if (m.yz != i) {
            while (error.free) {
                t = list[m.yz];
                if (t.op != 'j') {
                    break;
                }
                m.yz = t.yz;
            }
        }
    }

    function shorteer() {
        t = list[m.yz];
        if (terminal_op[t.op] === true) {
            list[i] = t;
        }
    }

// Make a table of labels, Remove the labels from the list.

    for (i = 0; i < l; i += 1) {
        m = list[i];
        if (isString(m)) {
            label[m] = j;
        } else {
            list[j] = m;
            j += 1;
        }
    }
    list.length = j;

// unlabel

    for (i = 0; i < j; i += 1) {
        m = list[i];
        if (isObject(m)) {
            if (m.op == 'opx') {
                m.yz = label[m.yz];
                i += 1;
            } else if (m.op.charAt(0) == 'j') {
                m.yz = label[m.yz];
            }
        }
    }

// short circuit

    for (i = 0; i < j; i += 1) {
        m = list[i];
        if (m.op == 'opx') {
            shorte();
            i += 1;
        } else if (m.op.charAt(0) == 'j') {
            shorte();
        }
    }

// dead removal

    reach(0);
    reach(1);
    for (i = list.length - 1; i >= 0; i -= 1) {
        if (!reached[i]) {
            delete_inst(i);
        }
    }

// defat

// Delete a jump to the next statement.
// Simplify a conditional jump around a jump.

    b = true;
    while (b) {
        b = false;
        i = 0;
        while (i < list.length) {
            m = list[i];
            if (m.op === 'j') {
                if (m.yz == i + 1) {
                    b = true;
                    delete_inst(i);
                }
            } else {
                var op = antijump[m.op];
                if (op) {
                    if (m.yz == i + 1) {
                        b = true;
                        delete_inst(i);
                    } else if (m.yz == i + 2 && list[i + 1].op == 'j') {
                        m.op = op;
                        m.yz = list[i + 1].yz;
                        b = true;
                        delete_inst(i + 1);
                    }
                }
            }
            i += 1;
        }
    }

// short circuit

    for (i = 0; i < list.length; i += 1) {
        m = list[i];
        if (m.op == 'j') {
            shorteer();
        }
    }

// dead removal

    reached = [];
    reach(0);
    reach(1);
    for (i = list.length - 1; i >= 0; i -= 1) {
        if (!reached[i]) {
            delete_inst(i);
        }
    }
    return list;
}


function numify(list) {

// compact

    var i, m, t;
    for (i = 0; i < list.length; i += 1) {
        m = list[i];
        t = (typeof m.op === 'number' ? m.op : op[m.op]) * 16777216;
        if (m.op == 'opx') {
            t += opx[m.x] * 65536;
        } else {
            t += (m.x * 65536) || 0;
        }
        if (m.yz !== undefined) {
            t += m.yz;
        } else {
            if (typeof m.y == 'string') {
                t += opu[m.y] * 256;
            } else {
                t += (m.y || 0) * 256;
            }
            t += m.z || 0;
        }
        if (!isNumber(t)) {
            return error("Bad instruction.", m);
        }
        list[i] = t;
    }
    return list;
}
