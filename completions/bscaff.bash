_bscaff_completions() {
	local cur prev opts
	COMPREPLY=()
	cur="${COMP_WORDS[COMP_CWORD]}"
	prev="${COMP_WORDS[COMP_CWORD-1]}"
	opts="save settings update delete search list copy open extract create transform --version --key --quiet --desc --tags --type --partial --overwrite --fail-if-exists --skip-if-exists"

	if [[ ${cur} == -* ]] ; then
		COMPREPLY=( $(compgen -W "--version --key --quiet --desc --tags --type --partial --overwrite --fail-if-exists --skip-if-exists" -- ${cur}) )
		return 0
	fi

	COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
	return 0
}
complete -F _bscaff_completions bscaff
