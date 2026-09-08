import React, { useState } from 'react';

function Campo({
  label,
  name,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-eyebrow">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

export const SiteContato: React.FC = () => {
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
      <div>
        <span className="label-eyebrow">Contato</span>
        <h1 className="mt-3 text-5xl leading-[1.08]">
          Vamos montar o seu <span className="text-primary">programa.</span>
        </h1>
        <p className="mt-5 max-w-md text-muted-foreground">
          Conte o nome da loja, quantos pontos você tem e qual recompensa quer oferecer. Respondemos
          em até um dia útil.
        </p>
        <div className="mt-8 space-y-2 text-sm text-muted-foreground">
          <p>contato@mimo.com.br</p>
          <p>Atendimento de segunda a sexta, 9h às 18h</p>
        </div>
      </div>

      <form
        className="surface-panel space-y-5 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          setEnviado(true);
        }}
      >
        {enviado ? (
          <div className="py-10 text-center">
            <h2 className="text-2xl">Recebemos o seu contato.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Este formulário ainda é uma demonstração e não envia mensagens de verdade. Quando
              quiser, ligamos ele a uma caixa de entrada real.
            </p>
          </div>
        ) : (
          <>
            <Campo label="Seu nome" name="nome" />
            <Campo label="Nome da loja" name="loja" />
            <Campo label="E-mail" name="email" type="email" />
            <Campo label="WhatsApp" name="telefone" type="tel" required={false} />
            <div>
              <label htmlFor="mensagem" className="label-eyebrow">
                Qual recompensa você quer oferecer?
              </label>
              <textarea
                id="mensagem"
                name="mensagem"
                rows={4}
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="Ex.: a cada 10 cafés, o 11º é grátis"
              />
            </div>
            <button type="submit" className="btn-mimo w-full cursor-pointer">
              Enviar
            </button>
          </>
        )}
      </form>
    </div>
  );
};
