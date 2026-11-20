<script lang="ts">
	import Bounded from '$lib/components/Bounded.svelte';

	let submitting = $state(false);
	let success = $state(false);
	let error = $state('');

	let submissionId = '';

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		success = false;
		error = '';

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		submissionId ||= crypto.randomUUID();
		formData.set('submissionId', submissionId);

		try {
			const response = await fetch('/api/send-email', {
				method: 'POST',
				body: formData
			});

			if (response.status === 429) {
				error = 'Too many requests. Please wait a few minutes and try again.';
				return;
			}
			const result = await response.json();

			if (response.ok && result.success) {
				// Clear form on success
				success = true;
				form.reset();
				submissionId = '';
			} else {
				error = result.error || 'Failed to send message';
			}
		} catch {
			error = 'Failed to send message';
		} finally {
			submitting = false;
		}
	}
</script>

<Bounded tag="div" class="bg-ink-noise relative p-4 font-body text-chalk">
	<div class="rounded-xl border border-white/10 bg-ink p-4">
		<form method="POST" action="/api/send-email" onsubmit={handleSubmit}>
			<label class="sr-only">
				Leave this field blank
				<input name="companyWebsite" type="text" tabindex="-1" autocomplete="off" maxlength="200" />
			</label>
			<label class="label py-2">
				<span>Name</span>
				<input
					name="name"
					maxlength="120"
					class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
					type="text"
					placeholder="John Doe"
					required
				/>
			</label>

			<label class="label py-2">
				<span>Email</span>
				<input
					name="email"
					maxlength="254"
					class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
					type="email"
					placeholder="John@Doe.com"
					required
				/>
			</label>

			<label class="label py-2">
				<span>Comment</span>
				<textarea
					name="message"
					maxlength="5000"
					class="placeholder:text-ink/40 textarea border border-white/10 bg-chalk text-ink focus:border-red-bright"
					placeholder="Get in touch with us!"
					rows="4"
					required
				></textarea>
			</label>

			<div class="mt-4">
				<button
					type="submit"
					class="hover:shadow-red/40 rounded-xl bg-gradient-to-br from-red to-red-bright px-5 py-3 font-display text-2xl font-black text-chalk hover:shadow-lg"
					disabled={submitting}
				>
					{submitting ? 'Sending...' : 'Submit'}
				</button>

				{#if success}
					<p role="status" class="mt-4 text-chalk">Message sent successfully!</p>
				{:else if error}
					<p role="alert" class="mt-4 text-red-bright">{error}</p>
				{/if}
			</div>
		</form>
	</div>
</Bounded>
