export {
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


const mutex_lock = (m, tid, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),
	
	...spin_trylock(m.held, t0),
	`btr  ${t0}, slow_${id}`,  	// enter the slow route if HELD occupied
	
	/* The fast */
	...spin_unlock(m.lock, t0),
	`br   end_${id}`,			// return, HELD acquired
	
	/* The slow */
	`lab  slow_${id}`,
	`lod  ${t0}, ${m.queue_tail}`,
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,	// add TID to queue
	`imm  ${t1}, 1`,
	`add  ${t0}, ${t1}`,	// tail + 1
	`sto  ${t0}, ${m.queue_tail}`,
	...spin_unlock(m.lock, t0),
	`blk`,	
	
	`lab  end_${id}`,
	/* Awaken, the HELD is ours now. No need to set HELD, because the
	thread who awoke us didn't unset it. Just continue running. */ ]
};
	
const mutex_unlock = (m, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),
	
	`lod  ${t0}, ${m.queue_head}`,
	`lod  ${t1}, ${m.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, empty_${id}`,
	
	/* queue non-empty */
	`lod  ${t0}, ${s.queue_head}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	`adi  ${t0}, +1`,
	`sto  ${t0}, ${s.queue_head}`,
	...spin_unlock(m.lock, t0),
	`pst  ${t1}`,
	`br   end_${id}`,
	
	/* queue empty */
	`lab  empty_${id}`,
	`imm  ${t0}, 0`,
	`sto  ${t0}, ${m.held}`, // release HELD
	...spin_unlock(m.lock, t0),
	`lab  end_${id}`, ];
};

const mtx = {
	lock: 0,
	held: 1,
	queue_head: 2,
	queue_tail: 3,
};


/* An example */
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
.loop();
