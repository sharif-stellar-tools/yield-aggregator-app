// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title MockUSDC
 * @notice Test token used for the vault
 */
contract MockUSDC is ERC20 {
    constructor() ERC20('Mock USDC', 'USDC') {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}

/**
 * @title Yield Vault
 * @notice ERC4626-based vault that accepts deposits and distributes yield
 * @dev This is the core contract where yield calculations and distributions happen
 */
contract Vault is ERC4626, Ownable {

    constructor(address _asset)
        ERC20('Yield Vault', 'yVault')
        ERC4626(IERC20(_asset))
    {}

    /**
     * @notice Distributes yield to the vault from the owner
     * @param amount Amount of yield (in asset tokens) to add to the vault
     * 
     * How it works:
     * 1. The owner (strategy or admin) calls this function
     * 2. They transfer tokens into the vault
     * 3. These tokens increase the total assets in the vault
     * 4. This automatically increases the share price for all depositors
     * 
     * This is the main mechanism that creates "yield" for users.
     */
    function distributeYield(uint256 amount) external onlyOwner {
        require(amount > 0, 'Amount must be > 0');

        // Step 1: Transfer yield tokens from the caller (owner/strategy) into the vault
        IERC20(asset()).transferFrom(msg.sender, address(this), amount);

        // Step 2: No extra math needed here — ERC4626 automatically handles share price increase
        // When new assets are added without minting new shares, the value of each existing share goes up.
        // This is how users earn yield passively.
        
        emit YieldDistributed(msg.sender, amount); // Optional event for tracking
    }

    /**
     * @notice Returns the number of decimals for the vault shares
     * @dev Usually matches the underlying asset (USDC = 6 decimals)
     */
    function decimals() public view override returns (uint8) {
        return super.decimals();
    }

    // =========================================================================
    // Yield Calculation Helper (Added for clarity)
    // =========================================================================

    /**
     * @notice Calculates the current APY (Annual Percentage Yield) based on recent yield distribution
     * @dev This is a simplified example. In production, you would track historical data.
     * 
     * Math Explanation:
     * APY = (Total Yield Distributed / Total Assets) * (365 / Days Since Last Distribution) * 100
     */
    function getCurrentAPY() external view returns (uint256 apy) {
        // In a real implementation, you would:
        // 1. Track total yield distributed over time
        // 2. Track average total assets
        // 3. Annualize the return
        
        uint256 totalAssetsNow = totalAssets();
        
        // Placeholder logic - replace with real historical tracking
        if (totalAssetsNow == 0) return 0;

        // Example: Assume 5000 yield was distributed over 30 days on 100_000 assets
        uint256 exampleYield = 5000 * 10 ** decimals(); // 30-day yield
        uint256 exampleAssets = 100_000 * 10 ** decimals();

        // Step-by-step APY calculation:
        uint256 periodicReturn = (exampleYield * 1e18) / exampleAssets;     // Return per period (18 decimals)
        uint256 annualizedReturn = periodicReturn * (365 / 30);             // Annualize (365 days)
        
        apy = annualizedReturn / 1e16; // Convert to percentage (e.g., 1825 = 18.25%)
    }

    // Event to track yield distribution
    event YieldDistributed(address indexed distributor, uint256 amount);
}