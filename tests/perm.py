class PermissionUser:
	def __init__(id, perm_level, can_leapfrog):
		self.id = id
		self.perm_level = perm_level
		self.can_leapfrog = can_leapfrog

	def can_override(self, other_user):
		return (self.perm_level > other_user.perm_level)
	
	def can_be_overridden(self, other_user):
		return (abs(self.perm_level - other_user.perm_level) == 1) and (other_user.can_leapfrog)
	
	