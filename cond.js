import {
	Frame, Scheduler
} from './conc.js'

import {
	spin_lock_yld,
	spin_unlock,
} from './spinlock.js'

import {
	mutex_lock,
	mutex_unlock,
} from './mutex.js'


const cond_wait = (c, m, tid, t0, t1) => [
	...spin_lock_yld(c.lock, t0),
	
	`lod  ${t0}, ${c.queue_tail}`,   // queue.add(self)
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,
	`imm  ${t1}, 1`,
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${c.queue_tail}`,
	
	...spin_unlock(c.lock, t0),
	...mutex_unlock(m, t0, t1),
	
	`blk`,         // block self
	
	...mutex_lock(m, 0, 0, 1),
];

const cond_signal = (c, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(c.lock, t0),
	
	`lod  ${t0}, ${c.queue_head}`,
	`lod  ${t1}, ${c.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, empty_${id}`,
	
	`imm  ${t1}, 1`, // increment head
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${c.queue_head}`,
	`sub  ${t0}, ${t1}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	...spin_unlock(c.lock, t0),
	`pst  ${t1}`,
	`br   end_${id}`,
	
	`lab  empty_${id}`,
	...spin_unlock(c.lock, t0),
	
	`lab  end_${id}`,
	];
};


/* An example */
const cond = {
	lock: 4,
	queue_head: 5,
	queue_tail: 6,
};

new Scheduler({
	'0': {  // waiter
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 0, 0, 1),
			
			'lab  check',
			'lod  0, 49',  // CRITICAL STARTS using mem[49] as required condition
			'btr  0, success',
			
			...cond_wait(cond, mtx, 0, 0, 1),
			
			'br   check',  // CRITICAL ENDS
			'lab  success',
			
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
			
			...cond_signal(cond, 0, 1),

			...mutex_unlock(mtx, 0, 1),
		],
	},
}, (o) => {
	// mutex's queue starts from mem[10]
	o.memory[2] = 10;
	o.memory[3] = 10;
	
	// cond's queue starts from mem[20]
	o.memory[5] = 20;
	o.memory[6] = 20;
})
.loop();
