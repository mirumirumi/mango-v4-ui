import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  Dispatch,
  SetStateAction,
} from 'react'
import { ArrowDownIcon } from '@heroicons/react/20/solid'
import NumberFormat, {
  NumberFormatValues,
  SourceInfo,
} from 'react-number-format'
import Decimal from 'decimal.js'
import mangoStore from '@store/mangoStore'
import { useTranslation } from 'next-i18next'
import { SIZE_INPUT_UI_KEY } from '../../utils/constants'
import useLocalStorageState from 'hooks/useLocalStorageState'
import SwapSlider from './SwapSlider'
import PercentageSelectButtons from './PercentageSelectButtons'
import Select from '@components/forms/Select'
import { floorToDecimal } from 'utils/numbers'
import { withValueLimit } from './MarketSwapForm'
import SellTokenInput from './SellTokenInput'
import BuyTokenInput from './BuyTokenInput'
import { notify } from 'utils/notifications'
import * as sentry from '@sentry/nextjs'
import { isMangoError } from 'types'
import Button from '@components/shared/Button'
import { useWallet } from '@solana/wallet-adapter-react'
import Loading from '@components/shared/Loading'
import TokenLogo from '@components/shared/TokenLogo'
import InlineNotification from '@components/shared/InlineNotification'

type LimitSwapFormProps = {
  setShowTokenSelect: Dispatch<SetStateAction<'input' | 'output' | undefined>>
}

type LimitSwapForm = {
  limitPrice: string | undefined
  triggerPrice: string
}
type FormErrors = Partial<Record<keyof LimitSwapForm, string>>

const ORDER_TYPES = [
  // 'trade:limit',
  'trade:stop-market',
  'trade:stop-limit',
]

const set = mangoStore.getState().set

const LimitSwapForm = ({ setShowTokenSelect }: LimitSwapFormProps) => {
  const { t } = useTranslation(['common', 'swap', 'trade'])
  const { connected } = useWallet()
  const [animateSwitchArrow, setAnimateSwitchArrow] = useState(0)
  const [orderType, setOrderType] = useState(ORDER_TYPES[0])
  const [triggerPrice, setTriggerPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [swapFormSizeUi] = useLocalStorageState(SIZE_INPUT_UI_KEY, 'slider')
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  const {
    margin: useMargin,
    inputBank,
    outputBank,
    amountIn: amountInFormValue,
    amountOut: amountOutFormValue,
    limitPrice,
  } = mangoStore((s) => s.swap)

  const amountInAsDecimal: Decimal | null = useMemo(() => {
    return Number(amountInFormValue)
      ? new Decimal(amountInFormValue)
      : new Decimal(0)
  }, [amountInFormValue])

  const [baseBank, quoteBank] = useMemo(() => {
    if (inputBank && inputBank.name === 'USDC') {
      return [outputBank, inputBank]
    } else if (outputBank && outputBank.name === 'USDC') {
      return [inputBank, outputBank]
    } else if (inputBank && inputBank.name === 'SOL') {
      return [outputBank, inputBank]
    } else return [inputBank, outputBank]
  }, [inputBank, outputBank])

  const setAmountInFormValue = useCallback((amountIn: string) => {
    set((s) => {
      s.swap.amountIn = amountIn
      if (!parseFloat(amountIn)) {
        s.swap.amountOut = ''
      }
    })
  }, [])

  const setAmountOutFormValue = useCallback((amountOut: string) => {
    set((s) => {
      s.swap.amountOut = amountOut
      if (!parseFloat(amountOut)) {
        s.swap.amountIn = ''
      }
    })
  }, [])

  const setLimitPrice = useCallback((price: string) => {
    set((s) => {
      s.swap.limitPrice = price
    })
  }, [])

  const initialQuotePrice = useMemo(() => {
    if (!baseBank || !quoteBank) return
    return floorToDecimal(
      baseBank.uiPrice / quoteBank.uiPrice,
      quoteBank.mintDecimals,
    )
  }, [baseBank, quoteBank])

  // set default limit and trigger price
  useEffect(() => {
    if (!initialQuotePrice) return
    if (!triggerPrice) {
      setTriggerPrice(
        initialQuotePrice.mul(0.9).toFixed(quoteBank?.mintDecimals),
      )
    }
    if (!limitPrice) {
      set((s) => {
        s.swap.limitPrice = initialQuotePrice
          .mul(0.8)
          .toFixed(quoteBank?.mintDecimals)
      })
    }
  }, [initialQuotePrice, limitPrice, quoteBank, triggerPrice])

  const [limitPriceDifference, triggerPriceDifference] = useMemo(() => {
    if (!initialQuotePrice) return [0, 0]
    const initialPrice = initialQuotePrice.toNumber()
    const limitDifference = limitPrice
      ? ((parseFloat(limitPrice) - initialPrice) / initialPrice) * 100
      : 0
    const triggerDifference = triggerPrice
      ? ((parseFloat(triggerPrice) - initialPrice) / initialPrice) * 100
      : 0
    return [limitDifference, triggerDifference]
  }, [initialQuotePrice, limitPrice, triggerPrice])

  // const isFormValid = useCallback(
  //   (form: LimitSwapForm) => {
  //     const invalidFields: FormErrors = {}
  //     setFormErrors({})
  //     const triggerPriceNumber = parseFloat(form.triggerPrice)
  //     const requiredFields: (keyof LimitSwapForm)[] = [
  //       'limitPrice',
  //       'triggerPrice',
  //     ]
  //     for (const key of requiredFields) {
  //       const value = form[key] as string
  //       if (!value) {
  //         if (orderType === 'trade:stop-market') {
  //           if (key !== 'limitPrice') {
  //             invalidFields[key] = t('settings:error-required-field')
  //           }
  //         } else {
  //           invalidFields[key] = t('settings:error-required-field')
  //         }
  //       }
  //     }
  //     if (
  //       orderType.includes('stop') &&
  //       initialQuotePrice &&
  //       triggerPriceNumber > initialQuotePrice.toNumber()
  //     ) {
  //       invalidFields.triggerPrice =
  //         'Trigger price must be less than current price'
  //     }
  //     if (form.limitPrice && form.limitPrice > form.triggerPrice) {
  //       invalidFields.limitPrice = 'Limit price must be less than trigger price'
  //     }
  //     if (Object.keys(invalidFields).length) {
  //       setFormErrors(invalidFields)
  //     }
  //     return invalidFields
  //   },
  //   [initialQuotePrice, orderType],
  // )

  /* 
    If the use margin setting is toggled, clear the form values
  */
  useEffect(() => {
    setAmountInFormValue('')
    setAmountOutFormValue('')
  }, [useMargin, setAmountInFormValue, setAmountOutFormValue])

  // the price to use for calculating the opposing side's size
  const sizePrice = useMemo(() => {
    return orderType === 'trade:stop-market' ? triggerPrice : limitPrice
  }, [limitPrice, orderType, triggerPrice])

  // get the out amount from the in amount and trigger or limit price
  const getAmountOut = useCallback(
    (amountIn: string, price: string) => {
      const amountOut =
        outputBank?.name === quoteBank?.name
          ? floorToDecimal(
              parseFloat(amountIn) * parseFloat(price),
              outputBank?.mintDecimals || 0,
            )
          : floorToDecimal(
              parseFloat(amountIn) / parseFloat(price),
              outputBank?.mintDecimals || 0,
            )
      return amountOut
    },
    [outputBank, quoteBank],
  )

  // get the in amount from the out amount and trigger or limit price
  const getAmountIn = useCallback(
    (amountOut: string, price: string) => {
      const amountIn =
        outputBank?.name === quoteBank?.name
          ? floorToDecimal(
              parseFloat(amountOut) / parseFloat(price),
              inputBank?.mintDecimals || 0,
            )
          : floorToDecimal(
              parseFloat(amountOut) * parseFloat(price),
              inputBank?.mintDecimals || 0,
            )
      return amountIn
    },
    [inputBank, outputBank, quoteBank],
  )

  const handleMax = useCallback(
    (amountIn: string) => {
      setAmountInFormValue(amountIn)
      if (parseFloat(amountIn) > 0 && sizePrice) {
        const amountOut = getAmountOut(amountIn, sizePrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [getAmountOut, setAmountInFormValue, setAmountOutFormValue, sizePrice],
  )

  const handleRepay = useCallback(
    (amountOut: string) => {
      setAmountOutFormValue(amountOut)
      if (parseFloat(amountOut) > 0 && sizePrice) {
        const amountIn = getAmountIn(amountOut, sizePrice)
        setAmountInFormValue(amountIn.toString())
      }
    },
    [getAmountIn, setAmountInFormValue, setAmountOutFormValue, sizePrice],
  )

  const handleAmountInChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setAmountInFormValue(e.value)
      if (parseFloat(e.value) > 0 && sizePrice) {
        const amountOut = getAmountOut(e.value, sizePrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [getAmountOut, setAmountInFormValue, setAmountOutFormValue, sizePrice],
  )

  const handleAmountOutChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setAmountOutFormValue(e.value)
      if (parseFloat(e.value) > 0 && sizePrice) {
        const amountIn = getAmountIn(e.value, sizePrice)
        setAmountInFormValue(amountIn.toString())
      }
    },
    [getAmountIn, setAmountInFormValue, setAmountOutFormValue, sizePrice],
  )

  const handleAmountInUi = useCallback(
    (amountIn: string) => {
      setAmountInFormValue(amountIn)
      if (sizePrice) {
        const amountOut = getAmountOut(amountIn, sizePrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [getAmountOut, setAmountInFormValue, setAmountOutFormValue, sizePrice],
  )

  const handleLimitPrice = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setFormErrors({})
      setLimitPrice(e.value)
      if (parseFloat(e.value) > 0 && parseFloat(amountInFormValue) > 0) {
        const amountOut = getAmountOut(amountInFormValue, e.value)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [amountInFormValue, setLimitPrice],
  )

  const handleTriggerPrice = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setFormErrors({})
      setTriggerPrice(e.value)
      if (
        parseFloat(e.value) > 0 &&
        parseFloat(amountInFormValue) > 0 &&
        orderType === 'trade:stop-market'
      ) {
        const amountOut = getAmountOut(amountInFormValue, e.value)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [amountInFormValue, orderType, setTriggerPrice],
  )

  const handleSwitchTokens = useCallback(() => {
    if (amountInAsDecimal?.gt(0) && sizePrice) {
      const amountOut =
        outputBank?.name !== quoteBank?.name
          ? amountInAsDecimal.mul(sizePrice)
          : amountInAsDecimal.div(sizePrice)
      setAmountOutFormValue(amountOut.toString())
    }
    set((s) => {
      s.swap.inputBank = outputBank
      s.swap.outputBank = inputBank
      // s.swap.limitPrice = ''
    })
    setAnimateSwitchArrow(
      (prevanimateSwitchArrow) => prevanimateSwitchArrow + 1,
    )
  }, [
    setAmountInFormValue,
    amountInAsDecimal,
    inputBank,
    orderType,
    outputBank,
    quoteBank,
    sizePrice,
  ])

  const handlePlaceStopLoss = useCallback(async () => {
    // const invalidFields = isFormValid({ limitPrice, triggerPrice })
    // if (Object.keys(invalidFields).length) {
    //   return
    // }
    try {
      const client = mangoStore.getState().client
      const group = mangoStore.getState().group
      const actions = mangoStore.getState().actions
      const mangoAccount = mangoStore.getState().mangoAccount.current
      const inputBank = mangoStore.getState().swap.inputBank
      const outputBank = mangoStore.getState().swap.outputBank

      if (
        !mangoAccount ||
        !group ||
        !inputBank ||
        !outputBank ||
        (!triggerPrice && orderType !== 'trade:limit') ||
        (!limitPrice && orderType !== 'trade:stop-market')
      )
        return
      setSubmitting(true)

      const orderPrice =
        orderType === 'trade:limit'
          ? parseFloat(limitPrice!)
          : parseFloat(triggerPrice)

      const stopLimitPrice =
        orderType !== 'trade:stop-market' ? parseFloat(limitPrice!) : 0

      try {
        const tx = await client.tokenConditionalSwapStopLoss(
          group,
          mangoAccount,
          inputBank.mint,
          orderPrice,
          outputBank.mint,
          stopLimitPrice,
          amountInAsDecimal.toNumber(),
          null,
          null,
        )
        notify({
          title: 'Transaction confirmed',
          type: 'success',
          txid: tx,
          noSound: true,
        })
        actions.fetchGroup()
        await actions.reloadMangoAccount()
      } catch (e) {
        console.error('onSwap error: ', e)
        sentry.captureException(e)
        if (isMangoError(e)) {
          notify({
            title: 'Transaction failed',
            description: e.message,
            txid: e?.txid,
            type: 'error',
          })
        }
      }
    } catch (e) {
      console.error('Swap error:', e)
    } finally {
      setSubmitting(false)
    }
  }, [orderType, limitPrice, triggerPrice, amountInAsDecimal])

  const limitOrderDisabled =
    !connected || !amountInFormValue || !amountOutFormValue

  return (
    <>
      <SellTokenInput
        className="rounded-b-none"
        handleAmountInChange={handleAmountInChange}
        setShowTokenSelect={setShowTokenSelect}
        handleMax={handleMax}
      />
      <div
        className={`grid ${
          orderType === 'trade:stop-limit' ? 'grid-cols-3' : 'grid-cols-2'
        } gap-2 rounded-b-xl bg-th-bkg-2 p-3 pt-1`}
        id="swap-step-two"
      >
        <div className="col-span-1">
          <p className="mb-2 text-th-fgd-2">{t('trade:order-type')}</p>
          <Select
            value={t(orderType)}
            onChange={(type) => setOrderType(type)}
            className="w-full"
            buttonClassName="ring-transparent rounded-t-lg rounded-b-lg focus:outline-none md:hover:bg-th-bkg-1 md:hover:ring-transparent focus-visible:bg-th-bkg-3 whitespace-nowrap"
          >
            {ORDER_TYPES.map((type) => (
              <Select.Option key={type} value={type}>
                {t(type)}
              </Select.Option>
            ))}
          </Select>
        </div>
        {orderType !== 'trade:limit' ? (
          <div className="col-span-1">
            <p className="mb-2 text-th-fgd-2">
              {t('trade:trigger-price')}{' '}
              <span className="text-xs text-th-fgd-3">
                {triggerPriceDifference
                  ? `(${triggerPriceDifference.toFixed(2)}%)`
                  : ''}
              </span>
            </p>
            <div className="relative">
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={outputBank?.mintDecimals || 6}
                name="triggerPrice"
                id="triggerPrice"
                className="h-10 w-full rounded-lg bg-th-input-bkg p-3 pl-8 font-mono text-sm text-th-fgd-1 focus:outline-none md:hover:bg-th-bkg-1"
                placeholder="0.00"
                value={triggerPrice}
                onValueChange={handleTriggerPrice}
                isAllowed={withValueLimit}
              />
              <div className="absolute top-1/2 -translate-y-1/2 left-2">
                <TokenLogo bank={quoteBank} size={16} />
              </div>
            </div>
            {formErrors.triggerPrice ? (
              <div className="mt-1">
                <InlineNotification
                  type="error"
                  desc={formErrors.triggerPrice}
                  hideBorder
                  hidePadding
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {orderType !== 'trade:stop-market' ? (
          <div className="col-span-1">
            <p className="mb-2 text-th-fgd-2">
              {t('trade:limit-price')}{' '}
              <span className="text-xs text-th-fgd-3">
                {limitPriceDifference
                  ? `(${limitPriceDifference.toFixed(2)}%)`
                  : ''}
              </span>
            </p>
            <div className="relative">
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={outputBank?.mintDecimals || 6}
                name="limitPrice"
                id="limitPrice"
                className="h-10 w-full rounded-lg bg-th-input-bkg p-3 pl-8 font-mono text-sm text-th-fgd-1 focus:outline-none md:hover:bg-th-bkg-1"
                placeholder="0.00"
                value={limitPrice}
                onValueChange={handleLimitPrice}
                isAllowed={withValueLimit}
              />
              <div className="absolute top-1/2 -translate-y-1/2 left-2">
                <TokenLogo bank={quoteBank} size={16} />
              </div>
            </div>
            {formErrors.limitPrice ? (
              <div className="mt-1">
                <InlineNotification
                  type="error"
                  desc={formErrors.limitPrice}
                  hideBorder
                  hidePadding
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="my-2 flex justify-center">
        <button
          className="rounded-full border border-th-fgd-4 p-1.5 text-th-fgd-3 focus-visible:border-th-active md:hover:border-th-active md:hover:text-th-active"
          onClick={handleSwitchTokens}
        >
          <ArrowDownIcon
            className="h-5 w-5"
            style={
              animateSwitchArrow % 2 == 0
                ? { transform: 'rotate(0deg)' }
                : { transform: 'rotate(360deg)' }
            }
          />
        </button>
      </div>
      <BuyTokenInput
        handleAmountOutChange={handleAmountOutChange}
        setShowTokenSelect={setShowTokenSelect}
        handleRepay={handleRepay}
      />
      {swapFormSizeUi === 'slider' ? (
        <SwapSlider
          useMargin={useMargin}
          amount={amountInAsDecimal.toNumber()}
          onChange={(v) => handleAmountInUi(v)}
          step={1 / 10 ** (inputBank?.mintDecimals || 6)}
        />
      ) : (
        <PercentageSelectButtons
          amountIn={amountInAsDecimal.toString()}
          setAmountIn={(v) => handleAmountInUi(v)}
          useMargin={useMargin}
        />
      )}
      <Button
        onClick={handlePlaceStopLoss}
        className="mt-6 mb-4 flex w-full items-center justify-center text-base"
        disabled={limitOrderDisabled}
        size="large"
      >
        {submitting ? <Loading /> : t('swap:place-limit-order')}
      </Button>
    </>
  )
}

export default LimitSwapForm
