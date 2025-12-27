// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

interface IERC7984Mintable {
    function mint(address to, uint64 amount) external;
}

contract TokenLottery {
    IERC7984Mintable[] private supportedTokens;
    uint256 private drawNonce;

    event LotteryReward(address indexed player, address indexed token, uint64 amount);

    constructor(address[] memory tokenAddresses) {
        require(tokenAddresses.length > 0, "TokenLottery: token list is empty");
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = tokenAddresses[i];
            require(tokenAddress != address(0), "TokenLottery: invalid token address");
            supportedTokens.push(IERC7984Mintable(tokenAddress));
        }
    }

    function draw() external {
        require(supportedTokens.length > 0, "TokenLottery: no tokens available");
        drawNonce++;

        uint256 randomValue = uint256(
            keccak256(
                abi.encode(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    drawNonce,
                    blockhash(block.number - 1)
                )
            )
        );

        uint256 tokenIndex = randomValue % supportedTokens.length;
        uint64 amount = uint64((randomValue % 100) + 1);

        IERC7984Mintable selectedToken = supportedTokens[tokenIndex];
        selectedToken.mint(msg.sender, amount);

        emit LotteryReward(msg.sender, address(selectedToken), amount);
    }

    function getSupportedTokens() external view returns (address[] memory tokens) {
        tokens = new address[](supportedTokens.length);
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            tokens[i] = address(supportedTokens[i]);
        }
    }

    function getTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }
}
