-- Fix: org members can read form_response_answers (for PDF and dashboard)
-- The previous policy only allowed the response owner and participant email.
-- Admin users from the same org were blocked.

-- form_response_answers SELECT
drop policy if exists "Pode ver respostas do formulário" on public.form_response_answers;

create policy "Pode ver respostas do formulário"
    on public.form_response_answers for select
    using (
        exists (
            select 1 from public.form_responses fr
            where fr.id = form_response_answers.response_id
              and (
                  -- Próprio dono da resposta
                  fr.user_id = auth.uid()
                  -- Participante (via email do pedido)
                  or exists (
                      select 1 from public.tickets t
                      join public.orders o on o.id = t.order_id
                      where t.id = fr.ticket_id
                        and o.participant_email = auth.email()
                  )
                  -- Membro da organização dona do formulário
                  or exists (
                      select 1 from public.forms f
                      join public.organization_members om on om.organization_id = f.organization_id
                      where f.id = fr.form_id
                        and om.user_id = auth.uid()
                  )
              )
        )
    );

-- form_responses SELECT (garante que org members também conseguem ver)
drop policy if exists "Pode ver própria resposta de formulário" on public.form_responses;

create policy "Pode ver própria resposta de formulário"
    on public.form_responses for select
    using (
        form_responses.user_id = auth.uid()
        or exists (
            select 1 from public.tickets t
            join public.orders o on o.id = t.order_id
            where t.id = form_responses.ticket_id
              and o.participant_email = auth.email()
        )
        or exists (
            select 1 from public.forms f
            join public.organization_members om on om.organization_id = f.organization_id
            where f.id = form_responses.form_id
              and om.user_id = auth.uid()
        )
    );
