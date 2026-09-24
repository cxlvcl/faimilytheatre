interface Props {
  retry: () => void
}

export function LoadError({ retry }: Props) {
  return (
    <div className="load-error" role="alert">
      <p>Не удалось загрузить содержимое</p>
      <button type="button" onClick={retry}>
        Попробовать снова
      </button>
    </div>
  )
}

