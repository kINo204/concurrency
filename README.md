# Concurrency

> Experimenting code for concurrency utilities.

Instead of writing an extension for a tiny OS, this project builds a compact
runtime virtual machine for hardware concurrency operation(which is relatively easy),
and build other software utilities based on it.

## Usage

### Scheduler

For each concurrency program, create a [`Scheduler`](https://github.com/kINo204/concurrency/blob/d43671aef7593f8e97fe1cf66437d58532a90614/conc.js#L14)with threads and run them:

```js
new Scheduler({
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
}).loop();
```

### Function & Calls

"Functions" (macros, instead) are implemented as lambdas returning *an array
of parameterized strings*, e.g.:

```js
const spin_lock_yld = (lock, t) => [
	`cas  ${t}, ${lock}`,	// check the lock
	`bfs  ${t}, :+3`,		// go in if lock acquired
	`yld`,					// else yld, and try again next time
	`br   :-3`,
];
```

As the final `cmds` when constructing a thread is also an array of instructions,
any "function" can be called by flattening:

```js
cmds: [ ...spin_lock_yld(0, 2) ]
```

### Instruction Set

[`conc.js`](https://github.com/kINo204/concurrency/blob/d43671aef7593f8e97fe1cf66437d58532a90614/conc.js#L80) provides a set of "assembly instructions" that can form the basic program structure of `cmds`.

## Files

Currently, there are three types of files:

- runtime environment: `conc.js`
- libraries: `queue.js`
- concurrent utilities
- examples

## Concurrent Utilities

| Utility            | File           |
| ------------------ | -------------- |
| spinlock           | `spinlock.js`  |
| mutex              | `mutex.js`     |
| condition variable | `cond.js`      |
| semaphore          | `semaphore.js` |
