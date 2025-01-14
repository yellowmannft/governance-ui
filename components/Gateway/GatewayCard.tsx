import Button from '@components/Button'
import Loading from '@components/Loading'
import useRealm from '@hooks/useRealm'
import { NftVoterClient } from '@solana/governance-program-library'
import {
  getTokenOwnerRecordAddress,
  SYSTEM_PROGRAM_ID,
  withCreateTokenOwnerRecord,
} from '@solana/spl-governance'
import { Transaction, TransactionInstruction } from '@solana/web3.js'
import { sendTransaction } from '@utils/send'
import { getNftVoterWeightRecord } from 'NftVotePlugin/sdk/accounts'
import { useState, useEffect } from 'react'
import useVotePluginsClientStore from 'stores/useVotePluginsClientStore'
import useWalletStore from 'stores/useWalletStore'
import useGatewayPluginStore from '../../GatewayPlugin/store/gatewayPluginStore'
import { GatewayButton } from '@components/Gateway/GatewayButton'

// TODO lots of overlap with NftBalanceCard here - we need to separate the logic for creating the Token Owner Record
// from the rest of this logic
const GatewayCard = () => {
  const connected = useWalletStore((s) => s.connected)
  const wallet = useWalletStore((s) => s.current)
  const client = useVotePluginsClientStore(
    (s) => s.state.currentRealmVotingClient
  )
  const gatekeeperNetwork = useGatewayPluginStore(
    (s) => s.state.gatekeeperNetwork
  )
  const isLoading = useGatewayPluginStore((s) => s.state.isLoadingGatewayToken)
  const connection = useWalletStore((s) => s.connection)
  const [, setTokenOwneRecordPk] = useState('')
  const { tokenRecords, realm, mint, councilMint } = useRealm()
  const { fetchRealm } = useWalletStore((s) => s.actions)
  const ownTokenRecord = wallet?.publicKey
    ? tokenRecords[wallet.publicKey!.toBase58()]
    : null
  const handleRegister = async () => {
    const instructions: TransactionInstruction[] = []
    const { voterWeightPk } = await getNftVoterWeightRecord(
      realm!.pubkey,
      realm!.account.communityMint,
      wallet!.publicKey!,
      client.client!.program.programId
    )
    const createVoterWeightRecordIx = await (client.client as NftVoterClient).program.methods
      .createVoterWeightRecord(wallet!.publicKey!)
      .accounts({
        voterWeightRecord: voterWeightPk,
        governanceProgramId: realm!.owner,
        realm: realm!.pubkey,
        realmGoverningTokenMint: realm!.account.communityMint,
        payer: wallet!.publicKey!,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction()
    instructions.push(createVoterWeightRecordIx)
    await withCreateTokenOwnerRecord(
      instructions,
      realm!.owner!,
      realm!.pubkey,
      wallet!.publicKey!,
      realm!.account.communityMint,
      wallet!.publicKey!
    )
    const transaction = new Transaction()
    transaction.add(...instructions)

    await sendTransaction({
      transaction: transaction,
      wallet: wallet!,
      connection: connection.current,
      signers: [],
      sendingMessage: `Registering`,
      successMessage: `Registered`,
    })
    await fetchRealm(realm?.owner, realm?.pubkey)
  }

  useEffect(() => {
    const getTokenOwnerRecord = async () => {
      const defaultMint = !mint?.supply.isZero()
        ? realm!.account.communityMint
        : !councilMint?.supply.isZero()
        ? realm!.account.config.councilMint
        : undefined
      const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
        realm!.owner,
        realm!.pubkey,
        defaultMint!,
        wallet!.publicKey!
      )
      setTokenOwneRecordPk(tokenOwnerRecordAddress.toBase58())
    }
    if (realm && wallet?.connected) {
      getTokenOwnerRecord()
    }
  }, [realm?.pubkey.toBase58(), wallet?.connected])

  return (
    <div className="bg-bkg-2 pt-4 md:pt-6 rounded-lg">
      <div className="space-y-4">
        {!connected && (
          <div className="text-xs bg-bkg-3 p-3">Please connect your wallet</div>
        )}
        {isLoading && <Loading></Loading>}
        {!isLoading &&
          connected &&
          wallet &&
          wallet.publicKey &&
          gatekeeperNetwork && <GatewayButton />}
      </div>
      {connected && !ownTokenRecord && (
        <Button className="w-full" onClick={handleRegister}>
          Join
        </Button>
      )}
    </div>
  )
}
export default GatewayCard
