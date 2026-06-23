import { XlmZapStrategy } from '../core/strategies/XlmZapStrategy';
import { ZapQuote } from '../core/strategies/IZapStrategy';

export class ZapModal {
  private modal: HTMLElement | null = null;
  private zapStrategy: XlmZapStrategy;
  private currentQuote: ZapQuote | null = null;
  private onSuccess?: (lpTokens: number, txHash: string) => void;
  
  constructor() {
    this.zapStrategy = new XlmZapStrategy();
  }
  
  /**
   * Open the Zap modal
   * @param onSuccessCallback - Callback function when zap succeeds
   */
  open(onSuccessCallback?: (lpTokens: number, txHash: string) => void): void {
    this.onSuccess = onSuccessCallback;
    this.render();
    this.attachEventListeners();
  }
  
  /**
   * Close the Zap modal
   */
  close(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      this.currentQuote = null;
    }
  }
  
  /**
   * Render the modal HTML
   */
  private render(): void {
    // Remove existing modal if any
    const existing = document.getElementById('zap-modal');
    if (existing) existing.remove();
    
    const modalHtml = `
      <div id="zap-modal" class="zap-modal">
        <div class="zap-modal-overlay" id="zap-modal-overlay"></div>
        <div class="zap-modal-content">
          <div class="zap-modal-header">
            <h3>Zap into Liquidity Pool</h3>
            <button class="zap-close-btn" id="zap-close-btn">&times;</button>
          </div>
          
          <div class="zap-modal-body">
            <div class="zap-info-box">
              <p>💡 Deposit a single asset and automatically add liquidity in one click!</p>
              <p>We'll handle the swap and deposit for you.</p>
            </div>
            
            <div class="zap-form">
              <div class="zap-form-group">
                <label for="zap-asset-select">Select Asset</label>
                <select id="zap-asset-select" class="zap-input">
                  <option value="">-- Choose Asset --</option>
                  <option value="USDC">USDC</option>
                  <option value="XLM">XLM</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
              
              <div class="zap-form-group">
                <label for="zap-amount-input">Amount</label>
                <input 
                  type="number" 
                  id="zap-amount-input" 
                  class="zap-input" 
                  placeholder="Enter amount to deposit"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div class="zap-form-group">
                <label for="zap-slippage-input">Max Slippage (%)</label>
                <input 
                  type="number" 
                  id="zap-slippage-input" 
                  class="zap-input" 
                  value="0.5"
                  min="0.1"
                  max="5"
                  step="0.1"
                />
              </div>
              
              <button id="zap-get-quote-btn" class="zap-btn zap-btn-secondary">
                Get Quote
              </button>
            </div>
            
            <div id="zap-quote-section" class="zap-quote-section" style="display: none;">
              <h4>Quote Details</h4>
              <div class="zap-quote-details">
                <div class="zap-quote-row">
                  <span>Estimated LP Tokens:</span>
                  <strong id="zap-estimated-lp">--</strong>
                </div>
                <div class="zap-quote-row">
                  <span>Expected APY:</span>
                  <strong id="zap-expected-apy">--</strong>
                </div>
                <div class="zap-quote-row">
                  <span>Asset Split:</span>
                  <div id="zap-asset-split">--</div>
                </div>
                <div class="zap-quote-row">
                  <span>Estimated Slippage:</span>
                  <strong id="zap-estimated-slippage">--</strong>
                </div>
              </div>
              
              <button id="zap-execute-btn" class="zap-btn zap-btn-primary">
                Execute Zap
              </button>
            </div>
            
            <div id="zap-loading" class="zap-loading" style="display: none;">
              <div class="zap-spinner"></div>
              <p id="zap-loading-text">Processing...</p>
            </div>
            
            <div id="zap-result" class="zap-result" style="display: none;">
              <div id="zap-result-content"></div>
            </div>
            
            <div id="zap-error" class="zap-error" style="display: none;"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('zap-modal');
    this.injectStyles();
  }
  
  /**
   * Attach event listeners to modal elements
   */
  private attachEventListeners(): void {
    const closeBtn = document.getElementById('zap-close-btn');
    const overlay = document.getElementById('zap-modal-overlay');
    const getQuoteBtn = document.getElementById('zap-get-quote-btn');
    const executeBtn = document.getElementById('zap-execute-btn');
    
    closeBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());
    getQuoteBtn?.addEventListener('click', () => this.handleGetQuote());
    executeBtn?.addEventListener('click', () => this.handleExecuteZap());
  }
  
  /**
   * Handle getting a quote for the zap
   */
  private async handleGetQuote(): Promise<void> {
    const assetSelect = document.getElementById('zap-asset-select') as HTMLSelectElement;
    const amountInput = document.getElementById('zap-amount-input') as HTMLInputElement;
    const errorDiv = document.getElementById('zap-error')!;
    const quoteSection = document.getElementById('zap-quote-section')!;
    
    const asset = assetSelect.value;
    const amount = parseFloat(amountInput.value);
    
    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Validation
    if (!asset) {
      this.showError('Please select an asset');
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      this.showError('Please enter a valid amount greater than 0');
      return;
    }
    
    // Show loading
    this.showLoading('Fetching quote...');
    quoteSection.style.display = 'none';
    
    try {
      const quote = await this.zapStrategy.getZapQuote(asset, amount);
      this.currentQuote = quote;
      this.displayQuote(quote);
      this.hideLoading();
      quoteSection.style.display = 'block';
    } catch (error) {
      this.hideLoading();
      this.showError(error instanceof Error ? error.message : 'Failed to get quote');
    }
  }
  
  /**
   * Handle executing the zap transaction
   */
  private async handleExecuteZap(): Promise<void> {
    if (!this.currentQuote) {
      this.showError('No quote available. Please get a quote first.');
      return;
    }
    
    const slippageInput = document.getElementById('zap-slippage-input') as HTMLInputElement;
    const maxSlippage = parseFloat(slippageInput.value) / 100;
    
    // Calculate minimum LP tokens based on slippage tolerance
    const minLPTokens = this.currentQuote.estimatedLPTokens * (1 - maxSlippage);
    
    this.showLoading('Executing zap transaction...');
    
    try {
      const result = await this.zapStrategy.executeZap(
        this.currentQuote.inputAsset,
        this.currentQuote.inputAmount,
        minLPTokens
      );
      
      this.hideLoading();
      
      if (result.success) {
        this.showSuccess(result.lpTokensReceived, result.txHash);
        if (this.onSuccess) {
          this.onSuccess(result.lpTokensReceived, result.txHash);
        }
      } else {
        this.showError(result.error || 'Transaction failed');
      }
    } catch (error) {
      this.hideLoading();
      this.showError(error instanceof Error ? error.message : 'Failed to execute zap');
    }
  }
  
  /**
   * Display quote details in the modal
   */
  private displayQuote(quote: ZapQuote): void {
    const estimatedLPEl = document.getElementById('zap-estimated-lp')!;
    const expectedAPYEl = document.getElementById('zap-expected-apy')!;
    const assetSplitEl = document.getElementById('zap-asset-split')!;
    const estimatedSlippageEl = document.getElementById('zap-estimated-slippage')!;
    
    estimatedLPEl.textContent = quote.estimatedLPTokens.toFixed(4);
    expectedAPYEl.textContent = `${(quote.apy * 100).toFixed(2)}%`;
    
    const splitHtml = quote.assetSplit
      .map(s => `<div>${s.amount.toFixed(4)} ${s.asset}</div>`)
      .join('');
    assetSplitEl.innerHTML = splitHtml;
    
    estimatedSlippageEl.textContent = `${(quote.slippage * 100).toFixed(2)}%`;
  }
  
  /**
   * Show loading state
   */
  private showLoading(message: string): void {
    const loadingDiv = document.getElementById('zap-loading')!;
    const loadingText = document.getElementById('zap-loading-text')!;
    const quoteSection = document.getElementById('zap-quote-section')!;
    const resultDiv = document.getElementById('zap-result')!;
    
    loadingText.textContent = message;
    loadingDiv.style.display = 'flex';
    quoteSection.style.display = 'none';
    resultDiv.style.display = 'none';
  }
  
  /**
   * Hide loading state
   */
  private hideLoading(): void {
    const loadingDiv = document.getElementById('zap-loading')!;
    loadingDiv.style.display = 'none';
  }
  
  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorDiv = document.getElementById('zap-error')!;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
  
  /**
   * Show success message
   */
  private showSuccess(lpTokens: number, txHash: string): void {
    const resultDiv = document.getElementById('zap-result')!;
    const resultContent = document.getElementById('zap-result-content')!;
    const quoteSection = document.getElementById('zap-quote-section')!;
    
    resultContent.innerHTML = `
      <div class="zap-success">
        <div class="zap-success-icon">✓</div>
        <h4>Zap Successful!</h4>
        <p>You received <strong>${lpTokens.toFixed(4)} LP tokens</strong></p>
        <p class="zap-tx-hash">Transaction: <code>${txHash}</code></p>
        <button id="zap-close-success-btn" class="zap-btn zap-btn-primary">Close</button>
      </div>
    `;
    
    quoteSection.style.display = 'none';
    resultDiv.style.display = 'block';
    
    const closeSuccessBtn = document.getElementById('zap-close-success-btn');
    closeSuccessBtn?.addEventListener('click', () => this.close());
  }
  
  /**
   * Inject CSS styles for the modal
   */
  private injectStyles(): void {
    const styleId = 'zap-modal-styles';
    if (document.getElementById(styleId)) return;
    
    const styles = `
      .zap-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .zap-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }
      
      .zap-modal-content {
        position: relative;
        background: #fff;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        animation: zap-modal-slide-in 0.3s ease-out;
      }
      
      @keyframes zap-modal-slide-in {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .zap-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .zap-modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        color: #1a1a2e;
      }
      
      .zap-close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
      }
      
      .zap-close-btn:hover {
        color: #000;
      }
      
      .zap-modal-body {
        padding: 1.5rem;
      }
      
      .zap-info-box {
        background: #f0f4ff;
        border-left: 3px solid #4f46e5;
        padding: 1rem;
        margin-bottom: 1.5rem;
        border-radius: 4px;
      }
      
      .zap-info-box p {
        margin: 0.25rem 0;
        font-size: 0.9rem;
        color: #1e293b;
      }
      
      .zap-form-group {
        margin-bottom: 1rem;
      }
      
      .zap-form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
        font-size: 0.9rem;
      }
      
      .zap-input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s;
      }
      
      .zap-input:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }
      
      .zap-btn {
        width: 100%;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .zap-btn-primary {
        background: #4f46e5;
        color: #fff;
      }
      
      .zap-btn-primary:hover {
        background: #4338ca;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      }
      
      .zap-btn-secondary {
        background: #e5e7eb;
        color: #374151;
      }
      
      .zap-btn-secondary:hover {
        background: #d1d5db;
      }
      
      .zap-quote-section {
        margin-top: 1.5rem;
        padding: 1rem;
        background: #f9fafb;
        border-radius: 8px;
      }
      
      .zap-quote-section h4 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        color: #1a1a2e;
      }
      
      .zap-quote-details {
        margin-bottom: 1rem;
      }
      
      .zap-quote-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .zap-quote-row:last-child {
        border-bottom: none;
      }
      
      .zap-quote-row span {
        color: #6b7280;
        font-size: 0.9rem;
      }
      
      .zap-quote-row strong {
        color: #1a1a2e;
      }
      
      .zap-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        gap: 1rem;
      }
      
      .zap-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e5e7eb;
        border-top-color: #4f46e5;
        border-radius: 50%;
        animation: zap-spin 0.8s linear infinite;
      }
      
      @keyframes zap-spin {
        to { transform: rotate(360deg); }
      }
      
      .zap-loading p {
        margin: 0;
        color: #6b7280;
      }
      
      .zap-error {
        padding: 0.75rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        color: #991b1b;
        margin-top: 1rem;
      }
      
      .zap-result {
        margin-top: 1rem;
      }
      
      .zap-success {
        text-align: center;
        padding: 1rem;
      }
      
      .zap-success-icon {
        width: 60px;
        height: 60px;
        margin: 0 auto 1rem;
        background: #10b981;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
      }
      
      .zap-success h4 {
        margin: 0 0 1rem 0;
        color: #1a1a2e;
      }
      
      .zap-success p {
        margin: 0.5rem 0;
        color: #374151;
      }
      
      .zap-tx-hash {
        font-size: 0.85rem;
        word-break: break-all;
      }
      
      .zap-tx-hash code {
        background: #f3f4f6;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}
