forge fmt && source .env && forge script ./script/Deploy.s.sol --rpc-url $LOCAL_RPC_URL  --private-key $LOCAL_PRIVATE_KEY --broadcast -vvvv

#source ./script/formatter.sh && source .env && forge script ./script/Goerli.s.sol --rpc-url $GOERLI_RPC_URL  --private-key $GOERLI_PRIVATE_KEY --broadcast -vvvv RUST_BACKTRACE=full
