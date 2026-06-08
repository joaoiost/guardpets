document.addEventListener('DOMContentLoaded', () => {
    // Função genérica para enviar formulários
    const vincularFormulario = (formId, endpoint, msgSucesso) => {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.innerText = "PROCESSANDO...";

            // Captura os dados automaticamente
            const dados = Object.fromEntries(new FormData(form).entries());

            try {
                const res = await fetch(`http://localhost:3000${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

                if (res.ok) {
                    alert("✅ " + msgSucesso);
                    Swal.fire('Sucesso!', msgSucesso, 'success');
                    form.reset();
                } else {
                    throw new Error();
                }
            } catch (err) {
                alert("❌ Erro ao conectar com o servidor.");
            } finally {
                btn.innerText = "ENVIAR";
            }
        });
    };

    // Vincula os IDs do seu HTML aos endpoints do Node
    vincularFormulario('form-denuncia', '/denuncia', 'Denúncia registrada no sistema!');
    vincularFormulario('form-reg', '/register', 'Sua conta foi criada!');
});