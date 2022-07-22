import { memo, useMemo, useState, useEffect, ChangeEvent } from 'react'
import { SearchIcon } from '@heroicons/react/outline'
import Image from 'next/image'
import { Token } from '../../types/jupiter'
import mangoStore from '../../store/state'
import Input from '../forms/Input'
import { IconButton } from '../shared/Button'
import { XIcon } from '@heroicons/react/solid'
import { useTranslation } from 'next-i18next'

const generateSearchTerm = (item: Token, searchValue: string) => {
  const normalizedSearchValue = searchValue.toLowerCase()
  const values = `${item.symbol} ${item.name}`.toLowerCase()

  const isMatchingWithSymbol =
    item.symbol.toLowerCase().indexOf(normalizedSearchValue) >= 0
  const matchingSymbolPercent = isMatchingWithSymbol
    ? normalizedSearchValue.length / item.symbol.length
    : 0

  return {
    token: item,
    matchingIdx: values.indexOf(normalizedSearchValue),
    matchingSymbolPercent,
  }
}

const startSearch = (items: Token[], searchValue: string) => {
  return items
    .map((item) => generateSearchTerm(item, searchValue))
    .filter((item) => item.matchingIdx >= 0)
    .sort((i1, i2) => i1.matchingIdx - i2.matchingIdx)
    .sort((i1, i2) => i2.matchingSymbolPercent - i1.matchingSymbolPercent)
    .map((item) => item.token)
}

const TokenItem = ({
  token,
  onSubmit,
}: {
  token: Token
  onSubmit: (x: string) => void
}) => {
  const { address, symbol, logoURI, name } = token
  return (
    <div>
      <button
        key={address}
        className="flex w-full cursor-pointer items-center justify-between rounded-md p-2 font-normal focus:bg-th-bkg-3 focus:outline-none md:hover:bg-th-bkg-4"
        onClick={() => onSubmit(symbol)}
      >
        <div className="flex items-center">
          <picture>
            <source srcSet={logoURI} type="image/webp" />
            <img src={logoURI} width="24" height="24" alt={symbol} />
          </picture>
          <div className="ml-2.5">
            <div className="text-left text-th-fgd-2">{symbol || 'unknown'}</div>
            <div className="text-left text-th-fgd-4">{name || 'unknown'}</div>
          </div>
        </div>
      </button>
    </div>
  )
}

const popularTokenSymbols = ['USDC', 'SOL', 'USDT', 'MNGO', 'BTC', 'ETH']

const SelectToken = ({
  onClose,
  onTokenSelect,
  type,
}: {
  onClose: () => void
  onTokenSelect: (x: string) => void
  type: string
}) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const tokens = mangoStore.getState().jupiterTokens
  const walletTokens = mangoStore((s) => s.wallet.tokens)

  const popularTokens = useMemo(() => {
    return walletTokens?.length
      ? tokens.filter((token) => {
          const walletMints = walletTokens.map((tok) => tok.mint.toString())
          return !token?.name || !token?.symbol
            ? false
            : popularTokenSymbols.includes(token.symbol) &&
                walletMints.includes(token.address)
        })
      : tokens.filter((token) => {
          return !token?.name || !token?.symbol
            ? false
            : popularTokenSymbols.includes(token.symbol)
        })
  }, [walletTokens, tokens])

  useEffect(() => {
    function onEscape(e: any) {
      if (e.keyCode === 27) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClose])

  const tokenInfos = useMemo(() => {
    if (tokens?.length) {
      const filteredTokens = tokens.filter((token) => {
        return !token?.name || !token?.symbol ? false : true
      })
      if (walletTokens?.length) {
        const walletMints = walletTokens.map((tok) => tok.mint.toString())
        return filteredTokens.sort(
          (a, b) =>
            walletMints.indexOf(b.address) - walletMints.indexOf(a.address)
        )
      } else {
        return filteredTokens
      }
    } else {
      return []
    }
  }, [tokens, walletTokens])

  const handleUpdateSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  const sortedTokens = search ? startSearch(tokenInfos, search) : tokenInfos

  return (
    <>
      <p className="mb-3">{type === 'input' ? t('sell') : t('buy')}</p>
      <IconButton
        className="absolute top-2 right-2"
        onClick={() => onClose()}
        hideBg
      >
        <XIcon className="h-5 w-5" />
      </IconButton>
      <div className="flex items-center text-th-fgd-4">
        <Input
          type="text"
          placeholder="Search by token or paste address"
          prefix={<SearchIcon className="h-5 w-5" />}
          autoFocus
          value={search}
          onChange={handleUpdateSearch}
        />
      </div>
      {popularTokens.length && onTokenSelect ? (
        <div className="mt-4 flex flex-wrap">
          {popularTokens.map((token) => (
            <button
              className="mx-1 mb-2 flex items-center rounded-md border border-th-bkg-4 py-1 px-3 hover:border-th-fgd-3 focus:border-th-fgd-2"
              onClick={() => onTokenSelect(token.symbol)}
              key={token.address}
            >
              <Image
                alt=""
                width="16"
                height="16"
                src={`/icons/${token.symbol.toLowerCase()}.svg`}
              />
              <span className="ml-1.5 text-th-fgd-1">{token.symbol}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="my-2 border-t border-th-bkg-4"></div>
      <div className="overflow-auto">
        {sortedTokens.map((token) => (
          <TokenItem
            key={token.address}
            token={token}
            onSubmit={onTokenSelect}
          />
        ))}
      </div>
    </>
  )
}

export default memo(SelectToken)
