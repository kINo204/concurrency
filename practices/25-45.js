import {
    Frame, Scheduler,
} from '../conc.js';

import {
    Semaphore, sem_post, sem_wait,
} from '../semaphore.js';

const npits  = new Semaphore(0);  // 0
const bpits  = new Semaphore(10);  // 3
const ntrees = new Semaphore(20);  // 0
const shovel = new Semaphore(30);  // 1

const N = 50;

new Scheduler(
{
    '0': {
        frame: new Frame(),
        cmds: [
            `imm  0, ${N}`,

            ...sem_wait(bpits,  0, 1, 2),
            ...sem_wait(shovel, 0, 1, 2),

            `prs  A-dig-pit`,

            ...sem_post(shovel, 1, 2),
            ...sem_post(npits, 1, 2),

            `adi  0, -1`,
            `btr  0, 1`,
        ]
    },
    '1': {
        frame: new Frame(),
        cmds: [
            ...sem_wait(npits, 1, 0, 1),
            `prs  B-plant-a-tree`,
            ...sem_post(bpits, 0, 1),

            ...sem_wait(shovel, 1, 0, 1),
            `prs  B-fill-a-pit`,
            ...sem_post(shovel, 0, 1),
            ...sem_post(ntrees, 0, 1),

            `br  0`,
        ]
    },
    '2': {
        frame: new Frame(),
        cmds: [
            ...sem_wait(ntrees, 2, 0, 1),
            `prs  C-water-a-tree`,
            `br   0`,
        ]
    },
},
o => {
    o.memory[1] = 0;
    o.memory[11] = 3;
    o.memory[21] = 0;
    o.memory[31] = 1;

    o.memory[2] = o.memory[3] = 4;
    o.memory[12] = o.memory[13] = 14;
    o.memory[22] = o.memory[23] = 24;
    o.memory[32] = o.memory[33] = 34;
},
false, 20, 40).loop();
