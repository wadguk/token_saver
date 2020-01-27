const assertRevert = require('./utils/assertRevert').assertRevert;
const timeHelper = require('./utils/utils.js');
const TokenSaverTest = artifacts.require("./contracts/TokenSaverTest.sol");
const ERC20 = artifacts.require("./ERC20.sol");

const totalERC20Contracts = 2;                                        // number of ERC20 tokens to create

contract('TokenSaver', async (accounts) => {

    const ownerAddress = "0xfE9B81C60EdE4999ee4e1e727A2DA108FCAfFDd1";
    const reserveAddress = "0xAf455dB5bc786a1371679ebbF253f9706640ceb7";
    const backendAddress = "0x7aED9EcbE13BFE56d08355477f12f5fd89072Ce7";
    const timeStamp = "1578663732";

    let tokenSaverAddress;
    let instanceERC20 = [];
    let ERC20Array = [];
    let instance;
    let blockNumber;

    beforeEach(async () => {
        instance = await TokenSaverTest.deployed();
    });

    for (let i = 0; i < totalERC20Contracts; i++) {

        it('ERC20 №' + i + ' Deployed', async () => {
            instanceERC20[i] = await ERC20.new(10000, {from: accounts[0]});
            ERC20Array.push(instanceERC20[i].address);
            assert.notEqual(instanceERC20[i].address, '', "No instance detected");
        })

        it('ERC20 №' + i + ' should have 10000 tokens on main balance', async () => {
            const balance = await instanceERC20[i].balanceOf(accounts[0], {from: accounts[0]});
            assert.equal(balance.words[0], 10000, "Initial balance is incorrect");
        })
    }

    it('Correct number of ERC20 instances (should be ' + totalERC20Contracts + ')', async () => {
        assert.equal(instanceERC20.length, totalERC20Contracts, "Total number of instances is incorrect");
    })

    it('TokenSaver deployed', async () => {
        tokenSaverAddress = TokenSaverTest.address;
        blockNumber = await web3.eth.getBlockNumber();
        web3.eth.getBlock(blockNumber, (error, block) => {
            const date = new Date(block.timestamp * 1000);
        });
        assert.notEqual(instance.address, '', "Deployment error");
    })

    it('Valid timestamp', async () => {
        const stamp = await instance.endTimestamp.call(web3.eth.accounts[0]);
        assert(timeStamp > Math.floor(Date.now() / 1000), "Time should be greater than now");
        assert(stamp > Math.floor(Date.now() / 1000), "Time should be greater than now");

    })

    it('Valid main address', async () => {
        await instance.owner.call(web3.eth.accounts[0]).then(function (result) {
            let addressCheck = web3.utils.isAddress(ownerAddress)
            assert.equal(addressCheck, true, "Invalid checksum or length");
            assert.notEqual(result, '', "Invalid address");
        })
    })

    it('Valid reserve address', async () => {
        await instance.reserveAddress.call(web3.eth.accounts[0]).then(function (result) {
            let addressCheck = web3.utils.isAddress(reserveAddress)
            assert.equal(addressCheck, true, "Invalid checksum or length");
            assert.notEqual(result, '', "Invalid address");
        })
    })

    for (let i = 0; i < totalERC20Contracts; i++) {
        it('Grant allowance to TokenSaver №'+i+' (should be 5000)', async () => {
            await instanceERC20[i].approve(tokenSaverAddress, 5000, {from: accounts[0]});
            await instanceERC20[i].allowance.call(accounts[0], tokenSaverAddress, {
                from: accounts[0]
            }, function (error, result) {
                if (!error) {
                    assert(result > 0, "Not approved");
                }
            })
        })
    }

    it('Add token types to Saver from incorrect address (should revert)', async () => {
            await assertRevert(instance.addTokenType(ERC20Array, {from: accounts[3]})
                , "Execution succeeded");
    })

    it('Add token types to Saver (from backend)', async () => {
            await instance.addTokenType(ERC20Array, {from: accounts[0]}).then(function (result) {
                assert.equal(result.receipt.status, true, "Token type has been rejected (30 max)");
            })
    })

    let eventList;
    it('All token instances have been added', async () => {
        const EXPECTED_AMOUNT = totalERC20Contracts;
        const options = {fromBlock: blockNumber, toBlock: 'latest'}

        eventList = await instance.getPastEvents('TokensToSave', options);
        assert.equal(eventList.length, EXPECTED_AMOUNT, "Expected " + instanceERC20.length + " got " + eventList.length + " (30 max)");
    })

    it('Try to add token that has been added before (should revert)', async () => {
        await assertRevert(instance.addTokenType(ERC20Array, {from: accounts[0]})
            , "Token has been added")
    })

    it('Try to add broken token address', async () => {
        await instance.addTokenType([accounts[5]], {from: accounts[0]}).then(function (result) {
            assert.equal(result.receipt.status, true, "Token type has been rejected (30 max)");
        })
    })

    it('Check if total amount of token types is not exceeded', async () => {
        const EXPECTED_AMOUNT = 30;
        assert(eventList.length <= EXPECTED_AMOUNT, "More than 30");
    })

    it('Transfer 500 tokens to Saver', async () => {
        for (let i = 0; i < eventList.length; i++) {
            await instanceERC20[i].transfer(tokenSaverAddress, 500, {from: accounts[0]}).then(function (error, result) {
            })
            await instanceERC20[i].balanceOf(tokenSaverAddress, {from: accounts[0]}, function (error, result) {
                if (!error) {
                    assert.equal(result, 500, "Failed to transfer 500 tokens");
                }
            });
        }
    })

    it('Execute token transfer before the correct time (should revert) ', async () => {
        await instance.endTimestamp.call(web3.eth.accounts[0]).then(function (result) {
            const date = new Date(result * 1000);
        })
        await assertRevert(web3.eth.sendTransaction({
            from: accounts[0],
            to: TokenSaverTest.address,
            gas: 6000000
        }), "Execution succeeded");
    })

    it('Execute token transfer at correct time', async () => {
        let now = new Date();
        advancement = 86400 * 10 // 10 Days
        await timeHelper.advanceTimeAndBlock(advancement);
        await web3.eth.sendTransaction({
            from: accounts[0],
            to: TokenSaverTest.address,
            gas: 6000000
        }).then(function (result) {
            if (result) {
                assert.notEqual(result.transactionHash, '', "Failed to save tokens");
            }
        });
    })

    for (let i = 0; i < totalERC20Contracts; i++) {
        it('Check balance of reserve address №'+i+' (should have 5500)', async () => {
            await instanceERC20[i].balanceOf(accounts[1], {from: accounts[0]}, function (error, result) {
                if (!error) {
                    assert.equal(result, 5500, "Failed to save tokens!");
                }
            });
        })
    }

    it('Try to destroy contract from incorrect address (should revert)', async () => {
        await assertRevert(instance.selfdestruction({from: accounts[4]}), "Execution succeeded")
    })

    it('Self destruction done!', async () => {
        await instance.selfdestruction({from: accounts[0]});

        const EXPECTED = true;
        const options = {fromBlock: blockNumber, toBlock: 'latest'}
        const event = await instance.getPastEvents('SelfdestructionEvent', options);
        assert.equal(event[0].returnValues.status, EXPECTED, "Self destruction failed");

    })

})

