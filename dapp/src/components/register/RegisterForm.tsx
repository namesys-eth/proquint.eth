import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { RegistrationSetup } from './RegistrationSetup'
import { TransactionStatus } from './TransactionStatus'
import { CommitmentWaiting } from './CommitmentWaiting'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { validateProquint, proquintToBytes4, calculatePrice, isPalindromic, bytes4ToProquint, generateRandomBytes, formatPrice } from '../../libs/proquint'
import { createCommitment, saveCommitment, checkCommitmentAge } from '../../libs/commitment'
import { useAvailability } from '../../hooks/useAvailability'

const ZERO_ID = '0x00000000'

type Step = 'setup' | 'commit' | 'wait' | 'register' | 'success'

export function RegisterForm() {
  const { address } = useAccount()
  const [proquint, setProquint] = useState('')
  const [years, setYears] = useState(1)
  const [receiver, setReceiver] = useState('')
  const [resolvedReceiver, setResolvedReceiver] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('setup')
  const [commitmentData, setCommitmentData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [commitTxConfirmed, setCommitTxConfirmed] = useState(false)
  const [commitTxHash, setCommitTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const normalizedId: `0x${string}` | null = (() => {
    try {
      return validateProquint(proquint) ? proquintToBytes4(proquint) : null
    } catch {
      return null
    }
  })()
  const normalizedProquint = normalizedId ? bytes4ToProquint(normalizedId) : null

  const { availability } = useAvailability(proquint)
  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash })

  // Calculate price in wei based on years and palindromic status
  const price = useMemo(() => {
    if (!proquint || !validateProquint(proquint)) return 0n
    const proquintId = proquintToBytes4(proquint)
    const isPalin = isPalindromic(proquintId)
    return calculatePrice(years, isPalin)
  }, [proquint, years])

  // Check if user already has a primary name (bytes4 ID)
  const { data: userPrimaryId } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Get user's inbox count
  const { data: userInboxCount } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const hasPrimary = !!(userPrimaryId && userPrimaryId !== ZERO_ID)
  const inboxCount = userInboxCount ? Number(userInboxCount) : 0

  // Start timer only after commit tx is confirmed
  useEffect(() => {
    if (step === 'wait' && commitTxConfirmed && commitmentData) {
      const { waitTime } = checkCommitmentAge(commitmentData.timestamp)
      const initialTime = waitTime ? Math.ceil(waitTime / 1000) : 0
      setTimeLeft(initialTime)

      const interval = setInterval(() => {
        const { ready, waitTime } = checkCommitmentAge(commitmentData.timestamp)
        setTimeLeft(ready ? 0 : Math.ceil((waitTime || 0) / 1000))
      }, 100)

      return () => clearInterval(interval)
    }
  }, [step, commitTxConfirmed, commitmentData])

  // Handle commit tx confirmation
  useEffect(() => {
    if (isSuccess && step === 'commit' && commitmentData && !commitTxConfirmed && hash) {
      const confirmTime = Date.now()
      const updatedCommitment = { ...commitmentData, timestamp: confirmTime }
      setCommitmentData(updatedCommitment)
      setCommitTxConfirmed(true)
      setCommitTxHash(hash)
      setStep('wait')
      setError(null)
    }
  }, [isSuccess, step, commitmentData, commitTxConfirmed, hash])

  // Handle errors
  useEffect(() => {
    if (writeError) {
      const errorMsg = writeError.message
      if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
        setError('Transaction rejected')
        if (step === 'commit') {
          setStep('setup')
          setCommitmentData(null)
          setCommitTxConfirmed(false)
        } else if (step === 'register') {
          setStep('wait')
        }
      } else {
        setError('Transaction failed: ' + errorMsg.slice(0, 100))
      }
    }
  }, [writeError, step])

  useEffect(() => {
    if (txError) {
      setError('Transaction failed: ' + txError.message.slice(0, 100))
      if (step === 'commit') setStep('setup')
    }
  }, [txError, step])

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (isSuccess && step === 'register') {
      setStep('success')
    }
  }, [isSuccess, step])

  const handleCommit = async () => {
    if (!address || !proquint || !validateProquint(proquint)) return
    setError(null)
    reset()

    const proquintId = proquintToBytes4(proquint)
    const secret = generateRandomBytes(27)

    // Determine register() vs registerTo()
    // register(input): caller has NO primary, minting to self → sets as primary
    // registerTo(input, to): minting to another address OR caller has primary → goes to inbox
    const finalReceiver = resolvedReceiver || address
    const mintingToOther = finalReceiver.toLowerCase() !== address.toLowerCase()
    const isRegisterTo = hasPrimary || mintingToOther

    // Commitment is bound to recipient:
    // register() → recipient = msg.sender
    // registerTo() → recipient = to
    const commitmentRecipient = isRegisterTo ? finalReceiver : address

    const commitment = createCommitment(years, proquintId, secret, commitmentRecipient as `0x${string}`)

    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'commit',
      args: [commitment.commitment],
    })

    const commitmentWithReceiver = { ...commitment, receiver: finalReceiver, isRegisterTo }
    saveCommitment(commitment.commitment, commitmentWithReceiver)
    setCommitmentData(commitmentWithReceiver)
    setStep('commit')
  }

  const handleRegister = async () => {
    if (!commitmentData) return

    const { ready, expired } = checkCommitmentAge(commitmentData.timestamp)

    if (expired) {
      setError('Commitment expired (15 min limit). Please start over.')
      setStep('setup')
      setCommitmentData(null)
      return
    }

    if (!ready) {
      setError(`Please wait ${timeLeft} more seconds`)
      return
    }

    setError(null)
    reset()

    const storedIsRegisterTo = commitmentData.isRegisterTo || false
    const storedReceiver = commitmentData.receiver || address

    if (storedIsRegisterTo) {
      // registerTo(input, to) — payable, sends ETH
      writeContract({
        address: CONTRACTS.ProquintNFT,
        abi: PROQUINT_ABI,
        functionName: 'registerTo',
        args: [commitmentData.data, storedReceiver as `0x${string}`],
        value: price,
      })
    } else {
      // register(input) — payable, sends ETH
      writeContract({
        address: CONTRACTS.ProquintNFT,
        abi: PROQUINT_ABI,
        functionName: 'register',
        args: [commitmentData.data],
        value: price,
      })
    }

    setStep('register')
  }

  const isAvailable = availability.status === 'available'
  const canRegister = timeLeft === 0 && commitmentData

  return (
    <div className="container">
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '1rem 1.5rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--danger)',
          borderRadius: '6px',
          color: 'var(--danger)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 1000,
          maxWidth: '400px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
      {step === 'setup' && (
        <RegistrationSetup
          proquint={proquint}
          setProquint={setProquint}
          years={years}
          setYears={setYears}
          receiver={receiver}
          setReceiver={setReceiver}
          onResolvedReceiverChange={setResolvedReceiver}
          address={address}
          price={price}
          normalizedProquint={normalizedProquint}
          normalizedId={normalizedId}
          isAvailable={isAvailable}
          canCommit={validateProquint(proquint) && isAvailable}
          isPending={isPending}
          isConfirming={isConfirming}
          onCommit={handleCommit}
          inboxCount={inboxCount}
          userPrimaryId={hasPrimary ? 'active' : ''}
        />
      )}

      {step === 'commit' && (
        <TransactionStatus
          step="commit"
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          proquint={proquint}
          normalizedId={normalizedId}
          price={price}
          years={years}
          receiverAddress={resolvedReceiver || address}
          onCancel={() => { setStep('setup'); setCommitmentData(null); }}
        />
      )}

      {step === 'wait' && (
        <CommitmentWaiting
          proquint={proquint}
          normalizedId={normalizedId}
          price={price}
          years={years}
          timeLeft={timeLeft}
          canRegister={canRegister}
          isPending={isPending}
          commitTxHash={commitTxHash}
          receiverAddress={resolvedReceiver || address}
          onRegister={handleRegister}
          onCancel={() => { setStep('setup'); setCommitmentData(null); setCommitTxConfirmed(false); setCommitTxHash(null); }}
        />
      )}

      {step === 'register' && (
        <TransactionStatus
          step="register"
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          proquint={proquint}
          normalizedId={normalizedId}
          price={price}
          years={years}
          receiverAddress={resolvedReceiver || address}
          onCancel={() => { setStep('setup'); setCommitmentData(null); setCommitTxConfirmed(false); }}
        />
      )}

      {step === 'success' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ padding: '1.5rem 0 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
            <div style={{
              fontFamily: "'SF Mono', 'Monaco', monospace",
              fontSize: 'clamp(1.8rem, 6vw, 2.8rem)',
              fontWeight: 800,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
              marginBottom: '0.2rem',
            }}>
              {proquint?.toUpperCase()}
            </div>
            {normalizedId && (
              <div style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                {normalizedId}
              </div>
            )}
          </div>

          {price && years && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <span>{years} {years === 1 ? 'year' : 'years'}</span>
              <span>{formatPrice(price)} ETH</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.href = `/${proquint}`}
              style={{ minWidth: '140px' }}
            >
              View Name
            </button>
            <button
              className="secondary"
              onClick={() => {
                setStep('setup')
                setProquint('')
                setCommitmentData(null)
                setCommitTxConfirmed(false)
                setCommitTxHash(null)
                reset()
              }}
              style={{ minWidth: '140px' }}
            >
              Register Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
