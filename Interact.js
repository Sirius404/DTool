const {Web3} = require('web3');
const fs = require('fs');
const csv = require('csv-parser');
var web3 = new Web3(Web3.givenProvider || "https://base-mainnet.infura.io/v3/{Your api key}");


const contractABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"blockVoted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"blocksPerVote","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"disableVoting","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"enableVoting","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"harrisToken","outputs":[{"internalType":"contract VoteToken","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"harrisVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"_blocksPerVote","type":"uint256"}],"name":"setBlocksPerVote","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"tokensPerVote","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"totalHarrisVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"totalTrumpVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"trumpToken","outputs":[{"internalType":"contract VoteToken","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"trumpVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userBlocknumberTimes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"voteForHarris","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"voteForTrump","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"votingEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"isTrumpToken","type":"bool"}],"name":"withdrawTokens","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// 合约地址
const contractAddress = '0xbe422bd7556afce0d629ae082ec41bb2bec3f522';

// 创建合约实例
const contract = new web3.eth.Contract(contractABI, contractAddress);



async function readPrivateKeysFromCSV(filePath) {
    return new Promise((resolve, reject) => {
        const privateKeys = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // 假设私钥在 CSV 的 "privateKey" 列中

                privateKeys.push(row.PrivateKey);
            })
            .on('end', () => {
                resolve(privateKeys);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// 调用投票函数
async function vote(methodName,account) {
    try {
        const balance = await web3.eth.getBalance(account.address);
        // 将余额转换为 ETH，并格式化为 9 位小数
        const balanceInEth = web3.utils.fromWei(balance, 'ether');
        console.log('账户余额:', parseFloat(balanceInEth).toFixed(9), 'ETH');

        const nonce = await web3.eth.getTransactionCount(account.address);
        const gasPrice = await web3.eth.getGasPrice();
        console.log('当前gas价格:', web3.utils.fromWei(gasPrice, 'gwei'), 'Gwei');
        // const gasPrice = web3.utils.toWei('0.011', 'gwei');
        const gasLimit = 200000; // 根据需要调整

        const data = contract.methods[methodName]().encodeABI();

        const tx = {
            from: account.address,
            to: contractAddress,
            gas: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce,
            data: data,
        };
        console.log(tx);

        // 签名交易
        const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);

        // 发送交易
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log(`${methodName} 交易成功，交易收据:`, receipt);
    } catch (error) {
        console.error(`${methodName} 交易失败:`, error);
    }
}

// 等待指定的时间（以毫秒为单位）
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeVotes(privateKeys, concurrencyLimit) {
    const results = [];
    const executing = new Set();

    for (const privateKey of privateKeys) {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        web3.eth.accounts.wallet.add(account);

        const voteTask = async () => {
            for (let i = 0; i < 10; i++) {
                try {
                    await Promise.all([
                        vote('voteForHarris', account),
                        vote('voteForTrump', account)
                    ]);
                    console.log(`私钥 ${privateKey} 第 ${i + 1} 次投票成功`);
                } catch (error) {
                    console.error(`私钥 ${privateKey} 第 ${i + 1} 次投票失败:`, error);
                }

                // 等待 3 秒
                await delay(3000);
            }
        };

        executing.add(voteTask());

        // 控制并发数量
        if (executing.size >= concurrencyLimit) {
            await Promise.race(executing);
            executing.delete(voteTask);
        }
    }

    // 等待所有任务完成
    await Promise.all(executing);
}

// 主函数
async function main() {
    const filePath = 'vote.csv'; // 替换为你的 CSV 文件路径
    const concurrencyLimit = 10; // 设置并发限制为 10
    try {
        const privateKeys = await readPrivateKeysFromCSV(filePath);
        await executeVotes(privateKeys, concurrencyLimit);
    } catch (error) {
        console.error('读取私钥时出错:', error);
    }
}

// 调用主函数
main();

