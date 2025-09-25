export {
    Queue,
    enqueue,
    dequeue,
    qlength,
}

class Queue {
    constructor(addr, beg, len) {
        [
            this.head,
            this.tail,
        ] = Array.from({length: 2}, (_, i) => addr + i);

        this.beg = beg;
        this.len = len;
    }
}

const qlength = (q, reg, t0) => [
    `lod  ${t0}, ${q.head}`,
    `lod  ${reg}, ${q.tail}`,
    `sub  ${reg}, ${t0}`,
]

const enqueue = (q, reg, t0) => [
    `lod  ${t0}, ${q.tail}`,
    `str  ${reg}, ${t0}`,

    `adi  ${t0}, 1`,
    `sbi  ${t0}, ${q.beg + q.len}`,
    `bfs  ${t0}, :+2`,
    `adi  ${t0}, ${q.len}`,
    `adi  ${t0}, ${q.beg}`,

    `sto  ${t0}, ${q.tail}`,

    // boundary check
    `lod  ${reg}, ${q.head}`,
    `sub  ${t0}, ${reg}`,
    `btr  ${t0}, :+2`,
    `err  inqueue-on-full`,
]

const dequeue = (q, reg, t0) => [
    // boundary check
    ...qlength(q, reg, t0),
    `btr  ${reg}, :+2`,
    `err  dequeue-on-empty`,

    `lod  ${t0}, ${q.head}`,
    `ldr  ${reg}, ${t0}`,

    `adi  ${t0}, 1`,
    `sbi  ${t0}, ${q.beg + q.len}`,
    `bfs  ${t0}, :+2`,
    `adi  ${t0}, ${q.len}`,
    `adi  ${t0}, ${q.beg}`,

    `sto  ${t0}, ${q.head}`,
]
