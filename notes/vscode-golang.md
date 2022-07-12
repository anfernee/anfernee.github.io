
## Run/Debug configuration

Sample config in `launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch test function",
            "type": "go",
            "request": "launch",
            "mode": "test",
            "program": "internal/internal_guite_test.go",
            "args": [
                "-test.run",
                "TestInternal",
                "--ginkgo.focus",
                "Counter"
            ]
        }
    ]
}
```
