import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import 'popper.js';
import 'tippy.js'
import 'tippy.js/dist/tippy.css'

import contractABI from './contributionABI.js'
import '../styles/style.css';
import {configureChains, createConfig, fetchEnsName, readContract, writeContract} from '@wagmi/core'
import {EthereumClient, w3mConnectors } from '@web3modal/ethereum'
import {Web3Modal} from '@web3modal/html'
import {goerli, mainnet} from '@wagmi/core/chains'
import {infuraProvider} from 'wagmi/providers/infura'
import {formatEther, parseEther} from "viem";

require.context('../images', false, /\.(png|jpe?g|gif|svg)$/);
require.context('../images/thumbnails', false, /\.(png|jpe?g|gif|svg)$/);

// Equivalent to importing from @wagmi/core/providers
const chains = [mainnet, goerli]
const projectId = '3e6e7e58a5918c44fa42816d90b735a6'
const chainId = 5;

const contractAddress = '0xb96A231384eEeA72A0EDF8b2e896FA4BaCAa22fF';


const {publicClient} = configureChains(chains, [
    // w3mProvider({projectId}),
    infuraProvider({apiKey: '2096b0699ab146b1a019961a2a9f9127'})])

const wagmiConfig = createConfig({
    autoConnect: true,
    connectors: w3mConnectors({projectId, chains}),
    publicClient
})
const ethereumClient = new EthereumClient(wagmiConfig, chains)
export const web3modal = new Web3Modal({
    projectId: projectId,
    themeVariables: {
        "--w3m-font-family": "monospace, sans-serif",
        "--w3m-accent-color": "blueviolet",
        "--w3m-background-color": "blueviolet",
    }
}, ethereumClient);



// Call updateFundingThreshold when DOM is loaded.
document.addEventListener("DOMContentLoaded", () => {
    hookupContributeButton();
    updateContributorsTable();
});

setInterval(updateContributorsTable, 5000);


function hookupContributeButton() {
    const contributeButton = document.getElementById('contribute-button');
    const inputElement = document.getElementById('user-amount');

    contributeButton.addEventListener('click', async function (event) {
        if (event.target !== inputElement) {
            await contribute();
        }
    });
}



function showWalletNotConnectedError() {
    showError("Please connect a wallet first");
}

async function contribute() {
    if (!isWalletConnected()) {
        showWalletNotConnectedError();
        return;
    }

    let userAmount = document.getElementById("user-amount").value;
    let combine = document.getElementById("combine-contribution-toggle").checked;

    let functionToCall = combine ? 'contributeAndCombine' : 'contribute';

    const {hash} = await writeContract({
            address: contractAddress,
            abi: contractABI,
            functionName: functionToCall,
            value: parseEther(userAmount),
            chainId: chainId,
    });
}


function isWalletConnected() {
    return ethereumClient.getAccount()['isConnected'];
}

function getContributionsByAddress(contributionsMetadata) {

    let contributionsByAddress = {}

    let contributors = contributionsMetadata[0]
    let amounts = contributionsMetadata[1]
    let combined = contributionsMetadata[2]
    let datetimes = contributionsMetadata[3]

    for (var i = 0; i < contributors.length; i++) {

        const address = contributors[i]
        if (!(address in contributionsByAddress)) {
            contributionsByAddress[address] = []
        }

        const is_combined = combined[i]
        const amount = amounts[i]
        const contributionMoment = datetimes[i]

        if (is_combined) {
            if (contributionsByAddress[address].length == 0) {
                contributionsByAddress[address].push(0)
            }
            contributionsByAddress[address][0] += amount
        } else {
            contributionsByAddress[address].push(amount)
        }
    }
    return contributionsByAddress;
}

function getTopContributions(contributionsByAddress) {
    let topContributions = []
    for (let address in contributionsByAddress) {
        let contributions = contributionsByAddress[address];
        for (var c = 0; c < contributions.length; c++) {
            topContributions.push([contributions[c], address]);
        }
    }

    function compareContributions(a, b) {
        if (a[0] > b[0]) {
            return -1;
        }
        if (a[0] < b[0]) {
            return 1;
        }
        return 0;
    }

    topContributions.sort(compareContributions);
    return topContributions;
}


function getLeaderboardTableBody() {
    const leaderboardTable = document.getElementById('leaderboard-table');
    return leaderboardTable.getElementsByTagName("tbody")[0];
}


async function updateContributorsTable() {

    const contributionsMetadata = await readContract({
        address: contractAddress,
        abi: contractABI,
        functionName: 'getAllContributions',
        chainId: chainId,
    });

    let contributionsByAddress = getContributionsByAddress(contributionsMetadata)

    // array, sorted by contribution amount, of arrays of [amount, address] 
    let leaders = getTopContributions(contributionsByAddress)
    const leaderRows = getLeaderboardTableBody().getElementsByTagName('tr');

    // Loop through the contributors and append a row for each
    for (var i = 0; i < leaderRows.length; i++) {
        let row = leaderRows[i];
        let thisLeader = leaders[i];

        if (thisLeader == undefined) {
            console.log("Not enough leaders to fill the rows.")
            return;
        }

        let bidSlot = row.getElementsByTagName('td')[1];
        let addressSlot = row.getElementsByTagName('td')[2];

        let amountInWei = thisLeader[0];
        bidSlot.innerHTML = formatEther(amountInWei) + " ETH";


        let ensName = await fetchEnsName({address: thisLeader[1], chainId: 1});
        if (ensName == undefined) {
            ensName = thisLeader[1];
        }
        addressSlot.innerHTML = ensName;
    }
    ;

}
