# Concurrency

> Experimenting code for concurrency utilities.

Instead of writing an extension for a tiny OS, this project builds a compact
runtime virtual machine for hardware concurrency operation(which is relatively easy),
and build other software utilities based on it.

## Files

Currently, there are three types of files:

- Runtime environment: `conc.js`
- Libraries: `queue.js`
- Concurrent utilities
- Examples

## Concurrent Utilities

| Utility            | File           |
| ------------------ | -------------- |
| spinlock           | `spinlock.js`  |
| mutex              | `mutex.js`     |
| condition variable | `cond.js`      |
| semaphore          | `semaphore.js` |
