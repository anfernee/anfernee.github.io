# Learning rust


### #[no\_mangle]
Tell rust compiler not to mangle the name of the function. It's useful when exposing the function
to other languages like C.




## Box

### Box::into_raw()
Make a raw pointer, for example `*mut Config`
```rust
// c is Result<Config>
Box::into_raw(Box::new(c))
```

[doc](https://doc.rust-lang.org/std/boxed/struct.Box.html#method.into_raw)