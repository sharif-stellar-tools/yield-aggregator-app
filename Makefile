default: build

all: test

# Build the Soroban contract to Wasm (target/wasm32v1-none/release/).
build:
	stellar contract build

# Build + run the Rust test suite.
test: build
	cargo test

# Build an optimized Wasm.
optimize:
	stellar contract build --optimize

# Build -> optimize -> deploy -> initialize on Testnet (see scripts/deploy.sh).
deploy:
	bash scripts/deploy.sh

# Format all Rust sources.
fmt:
	cargo fmt --all

clean:
	cargo clean

.PHONY: default all build test optimize deploy fmt clean
