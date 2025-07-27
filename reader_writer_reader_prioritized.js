import {
	Frame, Scheduler,
} from './conc.js';

import {
	spin_lock_yld, spin_unlock,
} from './spinlock.js'

import {
	Mutex, mutex_lock, mutex_unlock
} from './mutex.js';


const count = 10;
const s_count = 11;
const m_rw = new Mutex(0, 1, 2, 3);

const reader = tid => [
	...spin_lock_yld(s_count, 0),
	
	`lod  2, ${count}`,
	`btr  2, r${tid}_prw_over`,
	
	...mutex_lock(m_rw, tid, 0, 1),
	
	`lab  r${tid}_prw_over`,
	`adi  2, +1`,
	`sto  2, ${count}`,
	
	...spin_unlock(s_count, 0),
	
	/* Reader's work */
	`imm  3, 10`,
	`prs  Reading(${tid})...`,
	`adi  3, -1`,
	`btr  3, :-2`,
	
	...spin_lock_yld(s_count, 0),
	
	`lod  2, ${count}`,
	`adi  2, -1`,
	`sto  2, ${count}`,
	`btr  2, r${tid}_vrw_over`,
	
	...mutex_unlock(m_rw, 0, 1),
	
	`lab  r${tid}_vrw_over`,
	...spin_unlock(s_count, 0),
];

const writer = tid => [
	...mutex_lock(m_rw, tid, 0, 1),
	
	/* Writer's work */
	`imm  3, 20`,
	`prs  Writing(${tid})...`,
	`adi  3, -1`,
	`btr  3, :-2`,
	
	...mutex_unlock(m_rw, 0, 1),
];

new Scheduler(
{
	'0': {
		frame: new Frame,
		cmds: [ ...reader(0) ]
	},
	'1': {
		frame: new Frame,
		cmds: [ ...writer(1) ]
	},
	'2': {
		frame: new Frame,
		cmds: [ ...reader(2) ]
	},
},
o => {
	o.memory[2]  = o.memory[3] = 4;
}
).loop();

/* writer prioritized */
