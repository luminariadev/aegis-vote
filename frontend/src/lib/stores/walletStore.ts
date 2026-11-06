import { writable, get } from 'svelte/store';
import { BrowserProvider, Signer, Contract } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config';

declare global {
	interface Window {
		ethereum?: any;
	}
}

export const walletAddress = writable<string | null>(null);
export const provider = writable<BrowserProvider | null>(null);
export const signer = writable<Signer | null>(null);
export const chainId = writable<number | null>(null);
export const isConnecting = writable<boolean>(false);
export const error = writable<string | null>(null);

// Role states for connected address
export const isAdmin = writable<boolean>(false);
export const isOfficer = writable<boolean>(false);
export const isVoter = writable<boolean>(false);
export const userHasVoted = writable<boolean>(false);

export async function checkUserRoles(address: string, prov: BrowserProvider) {
	try {
		const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, prov);
		const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE();
		const officerRole = await contract.OFFICER_ROLE();
		const voterRole = await contract.VOTER_ROLE();

		const [adminStatus, officerStatus, voterStatus, votedStatus] = await Promise.all([
			contract.hasRole(defaultAdminRole, address),
			contract.hasRole(officerRole, address),
			contract.hasRole(voterRole, address),
			contract.hasVoted(address)
		]);

		isAdmin.set(adminStatus);
		isOfficer.set(officerStatus || adminStatus);
		isVoter.set(voterStatus);
		userHasVoted.set(votedStatus);
	} catch (e) {
		console.warn('Could not query account roles:', e);
		isAdmin.set(false);
		isOfficer.set(false);
		isVoter.set(false);
		userHasVoted.set(false);
	}
}

export async function connectWallet() {
	if (typeof window !== 'undefined' && window.ethereum) {
		isConnecting.set(true);
		error.set(null);
		try {
			const browserProvider = new BrowserProvider(window.ethereum);
			await browserProvider.send('eth_requestAccounts', []);
			const network = await browserProvider.getNetwork();
			const walletSigner = await browserProvider.getSigner();
			const address = await walletSigner.getAddress();

			provider.set(browserProvider);
			signer.set(walletSigner);
			walletAddress.set(address);
			chainId.set(Number(network.chainId));

			await checkUserRoles(address, browserProvider);

			// Listen for MetaMask account changes
			window.ethereum.on('accountsChanged', async (accounts: string[]) => {
				if (accounts.length > 0) {
					walletAddress.set(accounts[0]);
					if (get(provider)) {
						await checkUserRoles(accounts[0], get(provider)!);
					}
				} else {
					disconnectWallet();
				}
			});

			// Reload on chain changes
			window.ethereum.on('chainChanged', () => {
				window.location.reload();
			});
		} catch (err: any) {
			error.set(err.message || 'Failed to connect Web3 wallet');
		} finally {
			isConnecting.set(false);
		}
	} else {
		error.set('No Web3 wallet detected. Please install MetaMask or a compatible Web3 wallet.');
	}
}

export function disconnectWallet() {
	walletAddress.set(null);
	provider.set(null);
	signer.set(null);
	chainId.set(null);
	isAdmin.set(false);
	isOfficer.set(false);
	isVoter.set(false);
	userHasVoted.set(false);
}
