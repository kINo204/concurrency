import {
    Frame, Scheduler,
} from './conc.js';

import {
    Semaphore, sem_post, sem_wait,
} from './semaphore.js';

const chopsticks = new Array(5);
for (let i = 0; i < 5; i++)
    chopsticks[i] = new Semaphore(10 * i);

const left  = i => i;
const right = i => (i + 1) % 5;

const philosopher = i => [
    ...sem_wait(chopsticks[left(i)],  i, 0, 1),
    ...sem_wait(chopsticks[right(i)], i, 0, 1),
    `prs Philosopher_${i}`,
    ...sem_post(chopsticks[left(i)],  0, 1),
    ...sem_post(chopsticks[right(i)], 0, 1),
]

const threads = new Array(5);
for (let i = 0; i < 5; i++)
    threads[i] = {
        frame: new Frame(),
        cmds: philosopher(i),}

new Scheduler(threads,
              o => {
                for (let i = 0; i < 5; i++) {
                    o.memory[10 * i + 1] = 1;
                    o.memory[10 * i + 2] = 10 * i + 4;
                    o.memory[10 * i + 3] = 10 * i + 4;
                }
            }, true, 10).loop();
