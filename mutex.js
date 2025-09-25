export {
	Mutex,
	mutex_lock,
	mutex_unlock,
}

import {
	Frame, Scheduler
} from './conc.js'

import {
	spin_lock_yld,
	spin_trylock,
	spin_unlock,
} from './spinlock.js'

import {
	Queue,
	enqueue,
	dequeue,
	qlength,
} from './queue.js';


class Mutex {
	constructor(addr, queue_beg=addr+4, queue_len=6) {
		[
			this.lock,
			this.held,
		]
		= Array.from({length: 2}, (_, i) => addr + i);

		this.queue = new Queue(addr + 2, queue_beg, queue_len);
	}
}

const mutex_lock = (m, tid, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),
	
	...spin_trylock(m.held, t0),
	`btr  ${t0}, mtx_lock_slow_${id}`,  	// enter the slow route if HELD occupied
	
	/* The fast */
	...spin_unlock(m.lock, t0),
	`br   mtx_lock_end_${id}`,			// return, HELD acquired
	
	/* The slow */
	`lab  mtx_lock_slow_${id}`,
	`imm  ${t0}, ${tid}`,
	...enqueue(m.queue, t0, t1),
	...spin_unlock(m.lock, t0),
	`blk`,	
	
	`lab  mtx_lock_end_${id}`,
	/* Awaken, the HELD is ours now. No need to set HELD, because the
	thread who awoke us didn't unset it. Just continue running. */ ]
};
	
const mutex_unlock = (m, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),

	...qlength(m.queue, t0, t1),
	`bfs  ${t0}, mtx_unlock_empty_${id}`,
	
	/* queue non-empty */
	...dequeue(m.queue, t0, t1),
	...spin_unlock(m.lock, t1),
	`pst  ${t0}`,
	`br   mtx_unlock_end_${id}`,
	
	/* queue empty */
	`lab  mtx_unlock_empty_${id}`,
	`imm  ${t0}, 0`,
	`sto  ${t0}, ${m.held}`, // release HELD
	...spin_unlock(m.lock, t0),
	`lab  mtx_unlock_end_${id}`, ];
};


/* An example */
const mtx = new Mutex(0);

new Scheduler(
	{
	'0': {
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 0, 2, 3),
			
			'imm  0, -1',
			'imm  1, 15',
			'add  1, 0',
			'prt  1',
			'btr  1, :-2',
			
			...mutex_unlock(mtx, 2, 3),
			
			`imm  0, -1`,
			`imm  1, 15`,
			`add  1, 0`,
			`prt  1`,
			`btr  1, :-2`,
		]
	},
	'1': {
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 1, 0, 1),
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			...mutex_unlock(mtx, 0, 1),
		]
	},
},
(o) => {
	o.memory[2] = 4;
	o.memory[3] = 4;
})
// .loop();
