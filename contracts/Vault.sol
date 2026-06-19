// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract MockUSDC is ERC20 {
    constructor() ERC20('Mock USDC', 'USDC') {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}

contract Vault is ERC4626, Ownable {
    constructor(address _asset) 
        ERC20('Yield Vault', 'yVault')
        ERC4626(IERC20(_asset))
    {}

    function distributeYield(uint256 amount) external onlyOwner {
        require(amount > 0, 'Amount must be > 0');
       IERC20(asset()).transferFrom(msg.sender, address(this), amount);
    }

    function decimals() public view override returns (uint8) {
        return super.decimals();
    }
}