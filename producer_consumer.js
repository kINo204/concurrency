import {
	Frame, Scheduler,
} from './conc.js';

import {
	Mutex, mutex_lock, mutex_unlock
} from './mutex.js';

import {
	Semaphore, sem_post, sem_show, sem_wait,
} from './semaphore.js';

const nobjects = new Semaphore(0);
const nblanks  = new Semaphore(10);
const mtx = new Mutex(20);

const producer = tid => ({
	frame: new Frame(),
	cmds: [
		...sem_wait(nblanks, tid, 0, 1),
		...mutex_lock(mtx, tid, 0, 1),

		`prs  producer_${tid}`,

		...mutex_unlock(mtx, 0, 1),
		...sem_post(nobjects, 0, 1),
	]
})

const consumer = tid => ({
	frame: new Frame(),
	cmds: [
		...sem_wait(nobjects, tid, 0, 1),
		...mutex_lock(mtx, tid, 0, 1),

		`prs  consumer_${tid}`,

		...mutex_unlock(mtx, 0, 1),
		...sem_post(nblanks, 0, 1),
	]
})

const [M, N] = [5, 7];
const threads = Array.from({length: M}, (_, i)=>consumer(i))
				.concat(Array.from({length: N}, (_, i)=>producer(i + M)));
new Scheduler(
threads,
o=>{
	o.memory[11] = 2; // buffer length
	o.memory[2]  = o.memory[3]  = 4;
	o.memory[12] = o.memory[13] = 14;
	o.memory[22] = o.memory[23] = 24;
})
.loop();
