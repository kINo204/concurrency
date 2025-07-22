export {
	Semaphore,
	sem_wait,
	sem_post,
	sem_show,
}

import {
	Frame,
	Scheduler,
} from './conc.js'

import {
	spin_lock_yld,
    spin_unlock,
} from './spinlock.js'


function Semaphore(lock, val, queue_head, queue_tail) {
	this.lock = lock;
	this.val = val;
	this.queue_head = queue_head;
	this.queue_tail = queue_tail;
}

const sem_wait = (s, tid, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(s.lock, t0),
	
	`lod  ${t0}, ${s.val}`,
	`bfs  ${t0}, sem_wait_slow_${id}`,
	
	/* The fast */
	`adi  ${t0}, -1`,
	`sto  ${t0}, ${s.val}`,
	...spin_unlock(s.lock, t0),
	`br   sem_wait_end_${id}`,
	
	/* The slow */
	`lab  sem_wait_slow_${id}`,
	`lod  ${t0}, ${s.queue_tail}`,
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,
	`adi  ${t0}, 1`,
	`sto  ${t0}, ${s.queue_tail}`,
	...spin_unlock(s.lock, t0),
	// out of critical area, to avoid deadlock
	`blk`,
	
	`lab  sem_wait_end_${id}`,
]};

const sem_post = (s, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(s.lock, t0),
	
	`lod  ${t0}, ${s.queue_head}`,
	`lod  ${t1}, ${s.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, sem_post_empty_${id}`,
	
	/* queue non-empty */
	`lod  ${t0}, ${s.queue_head}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	`adi  ${t0}, +1`,
	`sto  ${t0}, ${s.queue_head}`,
	...spin_unlock(s.lock, t0),
	// out of critical area, to avoid competetion for lock
	`pst  ${t1}`,
	`br   sem_post_end_${id}`,
	
	/* queue empty */
	`lab  sem_post_empty_${id}`,
	`lod  ${t0}, ${s.val}`,
	`adi  ${t0}, +1`,
	`sto  ${t0}, ${s.val}`,
	...spin_unlock(s.lock, t0),
	
	`lab  sem_post_end_${id}`,
]};

const sem_show = (s, t0) => [
	`lod  ${t0}, ${s.val}`,
	`prt  ${t0}`,
];


/* An example */
const sem = new Semaphore(0, 1, 2, 3);
new Scheduler({
	'0': {
		frame: new Frame,
		cmds: [
			...sem_wait(sem, 0, 2, 3),
			
			'imm  0, -1',
			'imm  1, 15',
			'add  1, 0',
			'prt  1',
			'btr  1, :-2',
			
			...sem_post(sem, 2, 3),
			
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
			...sem_wait(sem, 1, 0, 1),
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			...sem_post(sem, 0, 1),
		]
	},	
}, o=>{
	o.memory[1] = 1;
	o.memory[2] = 4;
	o.memory[3] = 4;
})
.loop();
