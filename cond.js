import {
	Frame, Scheduler
} from './conc.js'

import {
	spin_lock_yld,
	spin_unlock,
} from './spinlock.js'

import {
	Mutex,
	mutex_lock,
	mutex_unlock,
} from './mutex.js'

import {
	Queue,
	qlength,
    enqueue,
    dequeue,
} from './queue.js';


class Cond {
	constructor(addr, queue_beg=addr+3, queue_len=7) {
		this.lock = addr;
		this.queue = new Queue(addr + 1, queue_beg, queue_len);
	}
}

const cond_wait = (c, m, tid, t0, t1) => [
	...spin_lock_yld(c.lock, t0),

	`imm  ${t0}, ${tid}`,
	...enqueue(c.queue, t0, t1),
	
	...spin_unlock(c.lock, t0),
	...mutex_unlock(m, t0, t1),
	
	`blk`,         // block self
	
	...mutex_lock(m, 0, 0, 1),
];

const cond_signal = (c, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(c.lock, t0),
	
	...qlength(c.queue, t0, t1),
	`bfs  ${t0}, empty_${id}`,
	
	...dequeue(c.queue, t1, t0),
	...spin_unlock(c.lock, t0),
	`pst  ${t1}`,
	`br   end_${id}`,
	
	`lab  empty_${id}`,
	...spin_unlock(c.lock, t0),
	
	`lab  end_${id}`,
	];
};


/* An example */
const cond = new Cond(0);
const mtx = new Mutex(10);

new Scheduler({
	'0': {  // waiter
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 0, 0, 1),
			
			'lab  check',
			`prs  checking...`,
			'lod  0, 49',  // CRITICAL STARTS using mem[49] as required condition
			'btr  0, success',
			
			...cond_wait(cond, mtx, 0, 0, 1),
			
			'br   check',  // CRITICAL ENDS
			'lab  success',
			`prs  success`,
			
			...mutex_unlock(mtx, 0, 1),
		],
		
	},
	'1': {  // poster
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 1, 0, 1),
			
			// Write mem[49] = 1, to satisfy the condition
			'imm  0, 1',
			'sto  0, 49',
			`prs  posted`,
			
			...cond_signal(cond, 0, 1),

			...mutex_unlock(mtx, 0, 1),
		],
	},
}, (o) => {
	o.memory[1] = o.memory[2] = 3;
	o.memory[12] = o.memory[13] = 14;
}, false)
// .loop();
