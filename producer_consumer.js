import {
	Frame, Scheduler,
} from './conc.js';

import {
	Mutex, mutex_lock, mutex_unlock
} from './mutex.js';

import {
	Semaphore, sem_post, sem_wait,
} from './semaphore.js';

const mtx = new Mutex(20, 21, 22, 23);
const nobjects = new Semaphore(0, 1, 2, 3);
const nblanks  = new Semaphore(10, 11, 12, 13);

new Scheduler(
{
	'0': {
		frame: new Frame(),
		cmds: [
			...sem_wait(nobjects, 0, 0, 1),
			
			...mutex_lock(mtx, 1, 0, 1),
			'prs  consumer_1',
			...mutex_unlock(mtx, 0, 1),
			
			...sem_post(nblanks, 0, 1),
		]
	},
	'1': {
		frame: new Frame(),
		cmds: [
			...sem_wait(nobjects, 1, 0, 1),
			
			...mutex_lock(mtx, 1, 0, 1),
			'prs  consumer_2',
			...mutex_unlock(mtx, 0, 1),
			
			...sem_post(nblanks, 0, 1),
		]
	},
	'2': {
		frame: new Frame(),
		cmds: [
			...sem_wait(nblanks, 2, 0, 1),
			
			...mutex_lock(mtx, 0, 0, 1),
			'prs  producer_1',
			...mutex_unlock(mtx, 0, 1),
			
			...sem_post(nobjects, 0, 1),
		]
	},
	'3': {
		frame: new Frame(),
		cmds: [
			...sem_wait(nblanks, 3, 0, 1),
			
			...mutex_lock(mtx, 0, 0, 1),
			'prs  producer_2',
			...mutex_unlock(mtx, 0, 1),
			
			...sem_post(nobjects, 0, 1),
		]
	},
},

o=>{
	o.memory[11] = 5; // buffer length
	o.memory[2]  = o.memory[3]  = 4;
	o.memory[12] = o.memory[13] = 14;
	o.memory[22] = o.memory[23] = 24;
})
.loop();
