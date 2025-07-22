export {
	spin_lock,
	spin_lock_yld,
	spin_trylock,
	spin_unlock,
}

import {
	Frame, Scheduler
} from './conc.js'


const spin_lock = (lock, t) => [
	`cas  ${t}, ${lock}`,
	`btr  ${t}, :-1`, ];
	
const spin_trylock = (lock, t) => [
	`cas  ${t}, ${lock}`, ];
	
const spin_unlock = (lock, t) => [
	`imm  ${t}, 0`,
	`sto  ${t}, ${lock}`, ];

const spin_lock_yld = (lock, t) => [
	`cas  ${t}, ${lock}`,	// check the lock
	`bfs  ${t}, :+3`,		// go in if lock acquired
	`yld`,					// else yld, and try again next time
	`br   :-3`,
	/* We may also yield only after a few spins;
	   Just spinning for ONE time here. */ ];


/* An example */
new Scheduler({
	'Thread-0': {
		frame: new Frame,
		cmds: [
			...spin_lock_yld(0, 2),
			
			'imm  0, -1',
			'imm  1, 50',
			'add  1, 0',
			'prt  1',
			'btr  1, :-2',
			
			...spin_unlock(0, 2),
		]
	},
	'Thread-1': {
		frame: new Frame,
		cmds: [
			...spin_lock_yld(0, 2),
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			...spin_unlock(0, 2),
		]
	},
})
// .loop();
